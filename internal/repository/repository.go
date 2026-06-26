// Package repository 是数据访问层（GORM）。
package repository

import (
	"context"
	"fmt"
	"strconv"
	"strings"

	"github.com/lib/pq"
	"github.com/xiaoxin/cms/internal/model"
	"gorm.io/gorm"
)

type Repo struct {
	DB *gorm.DB
}

func New(db *gorm.DB) *Repo { return &Repo{DB: db} }

// LogSearch 记录一次搜索用于热搜榜计数；关键词裁剪 + 长度校验。
func (r *Repo) LogSearch(ctx context.Context, keyword string) {
	k := strings.TrimSpace(keyword)
	if n := len([]rune(k)); n < 1 || n > 50 {
		return
	}
	r.DB.WithContext(ctx).Exec(`
		INSERT INTO search_terms (keyword, count, last_at) VALUES (?, 1, now())
		ON CONFLICT (keyword) DO UPDATE SET count = search_terms.count + 1, last_at = now()`, k)
}

// HotSearches 取热搜关键词（30 天内、按计数降序）。
func (r *Repo) HotSearches(ctx context.Context, limit int) []string {
	if limit < 1 || limit > 50 {
		limit = 10
	}
	out := []string{}
	r.DB.WithContext(ctx).Raw(`
		SELECT keyword FROM search_terms
		WHERE last_at > now() - interval '30 days'
		ORDER BY count DESC, last_at DESC LIMIT ?`, limit).Scan(&out)
	return out
}

// RandomTitle 随机一部（status=1、有海报；可按 kind/genre 过滤）。
func (r *Repo) RandomTitle(ctx context.Context, kind int16, genre int64) (*model.Title, error) {
	where := []string{"status = 1", "poster <> ''"}
	args := []any{}
	if kind > 0 {
		where = append(where, "kind = ?")
		args = append(args, kind)
	}
	if genre > 0 {
		where = append(where, "genre_ids @> ?")
		args = append(args, pq.Int64Array{genre})
	}
	var t model.Title
	err := r.DB.WithContext(ctx).Raw(
		fmt.Sprintf("SELECT * FROM titles WHERE %s ORDER BY random() LIMIT 1", strings.Join(where, " AND ")),
		args...).Scan(&t).Error
	if err != nil || t.ID == 0 {
		return nil, err
	}
	return &t, nil
}

// SemanticSearch 向量召回：按查询向量的余弦距离排序返回相近作品（需 pgvector + title_embeddings）。
func (r *Repo) SemanticSearch(ctx context.Context, vec []float32, kind int16, limit int) ([]model.Title, error) {
	if limit < 1 || limit > 60 {
		limit = 24
	}
	q := `SELECT t.* FROM titles t JOIN title_embeddings e ON e.title_id = t.id WHERE t.status = 1`
	args := []any{}
	if kind > 0 {
		q += " AND t.kind = ?"
		args = append(args, kind)
	}
	q += " ORDER BY e.embedding <=> ?::vector LIMIT ?"
	args = append(args, vecToPgVector(vec), limit)
	var list []model.Title
	err := r.DB.WithContext(ctx).Raw(q, args...).Scan(&list).Error
	return list, err
}

// vecToPgVector 把 []float32 转成 pgvector 文本字面量 "[a,b,c]"。
func vecToPgVector(v []float32) string {
	var b strings.Builder
	b.WriteByte('[')
	for i, x := range v {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(strconv.FormatFloat(float64(x), 'f', -1, 32))
	}
	b.WriteByte(']')
	return b.String()
}

// TitleFilter 列表筛选。
type TitleFilter struct {
	Kind   int16
	Genre  int64
	Year   int
	Region string // 地区桶：大陆/香港/台湾/日本/韩国/美国/泰国/英国/欧美
	Tag        string // 标签（来自 vod_class）
	Sort       string // popular | latest | rating | year | like | douban
	DoubanOnly bool   // 仅含有豆瓣评分的作品（豆瓣高分榜用）
	Adult      int    // 1=仅成人内容（伦理/里番），0=不限
	Page       int
	Size       int
}

// regionFilter 把地区桶翻译成 area 上的条件（参数化，防注入）。
func regionFilter(region string) (string, []any) {
	switch region {
	case "大陆":
		return "(area ILIKE ? OR area ILIKE ?)", []any{"%大陆%", "%内地%"}
	case "香港":
		return "area ILIKE ?", []any{"%香港%"}
	case "台湾":
		return "area ILIKE ?", []any{"%台湾%"}
	case "日本":
		return "area ILIKE ?", []any{"%日本%"}
	case "韩国":
		return "area ILIKE ?", []any{"%韩国%"}
	case "美国":
		return "area ILIKE ?", []any{"%美国%"}
	case "泰国":
		return "area ILIKE ?", []any{"%泰国%"}
	case "英国":
		return "area ILIKE ?", []any{"%英国%"}
	case "欧美":
		return "area ~ ?", []any{"美国|英国|法国|德国|西班牙|意大利|加拿大|澳大利亚|爱尔兰|挪威|丹麦|俄罗斯|墨西哥|荷兰|瑞典|波兰|希腊"}
	}
	return "", nil
}

func (f *TitleFilter) normalize() {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.Size < 1 || f.Size > 60 {
		f.Size = 24
	}
}

func sortClause(sort string) string {
	switch sort {
	case "newest":
		return "created_at DESC" // 最近上线（入库时间）
	case "latest":
		return "updated_at DESC"
	case "rating":
		return "vote_average DESC, vote_count DESC"
	case "year":
		return "year DESC NULLS LAST, popularity DESC"
	case "like":
		return "like_count DESC, popularity DESC"
	case "douban":
		return "douban_rating DESC, douban_votes DESC"
	default:
		return "popularity DESC, vote_count DESC"
	}
}

func (r *Repo) ListTitles(ctx context.Context, f TitleFilter) ([]model.Title, int64, error) {
	f.normalize()
	where := []string{"status = 1"}
	args := []any{}
	if f.Kind > 0 {
		where = append(where, "kind = ?")
		args = append(args, f.Kind)
	}
	if f.Genre > 0 {
		where = append(where, "genre_ids @> ?")
		args = append(args, pq.Int64Array{f.Genre})
	}
	if f.Year > 0 {
		where = append(where, "year = ?")
		args = append(args, f.Year)
	}
	if rc, ra := regionFilter(f.Region); rc != "" {
		where = append(where, rc)
		args = append(args, ra...)
	}
	if f.Tag != "" {
		where = append(where, "tags @> ?")
		args = append(args, pq.StringArray{f.Tag})
	}
	if f.Adult == 1 {
		where = append(where, "adult = true")
	}
	if f.DoubanOnly {
		where = append(where, "douban_rating > 0")
	}
	cond := strings.Join(where, " AND ")
	// 同系列(norm_title+kind)只取最新季那一条，避免列表里 S1/S2 各占一格
	seriesKey := "COALESCE(NULLIF(norm_title, ''), id::text)"
	base := fmt.Sprintf(
		`SELECT DISTINCT ON (%s, kind) * FROM titles WHERE %s
		 ORDER BY %s, kind, season DESC, year DESC NULLS LAST, popularity DESC`,
		seriesKey, cond, seriesKey)

	var total int64
	if err := r.DB.WithContext(ctx).
		Raw(fmt.Sprintf("SELECT count(*) FROM (%s) s", base), args...).
		Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []model.Title
	pageArgs := append(append([]any{}, args...), (f.Page-1)*f.Size, f.Size)
	err := r.DB.WithContext(ctx).
		Raw(fmt.Sprintf("SELECT * FROM (%s) t ORDER BY %s OFFSET ? LIMIT ?", base, sortClause(f.Sort)), pageArgs...).
		Scan(&list).Error
	return list, total, err
}

// RelatedTitles 相关推荐：同类型，题材重叠或同地区；排除自身及同系列其它季。
func (r *Repo) RelatedTitles(ctx context.Context, t *model.Title, limit int) ([]model.Title, error) {
	if limit <= 0 {
		limit = 12
	}
	where := []string{"status = 1", "kind = ?", "id <> ?", "NOT (norm_title <> '' AND norm_title = ?)"}
	args := []any{t.Kind, t.ID, t.NormTitle}
	var sim []string
	if len(t.GenreIDs) > 0 {
		sim = append(sim, "genre_ids && ?")
		args = append(args, t.GenreIDs)
	}
	if strings.TrimSpace(t.Area) != "" {
		sim = append(sim, "area = ?")
		args = append(args, t.Area)
	}
	if len(sim) > 0 {
		where = append(where, "("+strings.Join(sim, " OR ")+")")
	}
	seriesKey := "COALESCE(NULLIF(norm_title, ''), id::text)"
	q := fmt.Sprintf(`SELECT * FROM (
		SELECT DISTINCT ON (%s) * FROM titles WHERE %s ORDER BY %s, popularity DESC
	) s ORDER BY popularity DESC LIMIT ?`, seriesKey, strings.Join(where, " AND "), seriesKey)
	args = append(args, limit)
	var list []model.Title
	err := r.DB.WithContext(ctx).Raw(q, args...).Scan(&list).Error
	return list, err
}

// RecommendForUser 基于用户观看历史+收藏的题材偏好，推荐未看过的高人气作品。
// 取最常接触的 6 个题材，召回同题材、未看过、未收藏的作品，按人气排序（同系列只取一条）。
// 冷启动（无任何历史/收藏）返回空，由上层降级为热门。
func (r *Repo) RecommendForUser(ctx context.Context, userID int64, limit int) ([]model.Title, error) {
	if limit <= 0 {
		limit = 12
	}
	seriesKey := "COALESCE(NULLIF(norm_title, ''), id::text)"
	q := fmt.Sprintf(`
WITH seen AS (
  SELECT title_id FROM watch_history WHERE user_id = ?
  UNION
  SELECT title_id FROM favorites WHERE user_id = ?
),
prefs AS (
  SELECT genre FROM (
    SELECT unnest(t.genre_ids) AS genre, count(*) AS w
    FROM titles t JOIN seen s ON s.title_id = t.id
    GROUP BY genre
  ) g ORDER BY w DESC LIMIT 6
)
SELECT * FROM (
  SELECT DISTINCT ON (%s, kind) t.* FROM titles t
  WHERE t.status = 1
    AND EXISTS (SELECT 1 FROM prefs)
    AND t.genre_ids && (SELECT array_agg(genre) FROM prefs)
    AND t.id NOT IN (SELECT title_id FROM seen)
  ORDER BY %s, kind, popularity DESC
) s ORDER BY popularity DESC, vote_count DESC LIMIT ?`, seriesKey, seriesKey)
	var list []model.Title
	err := r.DB.WithContext(ctx).Raw(q, userID, userID, limit).Scan(&list).Error
	return list, err
}

// PersonTitles 某演员/导演的作品（名字模糊匹配 actors/director）。
func (r *Repo) PersonTitles(ctx context.Context, name string, page, size int) ([]model.Title, int64, error) {
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 60 {
		size = 30
	}
	like := "%" + strings.TrimSpace(name) + "%"
	seriesKey := "COALESCE(NULLIF(norm_title, ''), id::text)"
	base := fmt.Sprintf(`SELECT DISTINCT ON (%s) * FROM titles
		WHERE status = 1 AND (actors ILIKE ? OR director ILIKE ?) ORDER BY %s, popularity DESC`, seriesKey, seriesKey)
	var total int64
	r.DB.WithContext(ctx).Raw(fmt.Sprintf("SELECT count(*) FROM (%s) s", base), like, like).Scan(&total)
	var list []model.Title
	err := r.DB.WithContext(ctx).Raw(
		fmt.Sprintf("SELECT * FROM (%s) t ORDER BY popularity DESC OFFSET ? LIMIT ?", base),
		like, like, (page-1)*size, size).Scan(&list).Error
	return list, total, err
}

func (r *Repo) GetTitle(ctx context.Context, id int64) (*model.Title, error) {
	var t model.Title
	if err := r.DB.WithContext(ctx).Where("id = ? AND status = 1", id).First(&t).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

// TitleIDBySlug 按 slug 取作品 id（找不到返回 0）。
func (r *Repo) TitleIDBySlug(ctx context.Context, s string) int64 {
	if s == "" {
		return 0
	}
	var id int64
	r.DB.WithContext(ctx).Model(&model.Title{}).
		Where("slug = ? AND status = 1", s).Limit(1).Pluck("id", &id)
	return id
}

// TitlesByIDs 按给定 id 顺序返回（用于回填 Meili 命中顺序）。
func (r *Repo) TitlesByIDs(ctx context.Context, ids []int64) ([]model.Title, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var list []model.Title
	if err := r.DB.WithContext(ctx).Where("id IN ? AND status = 1", ids).Find(&list).Error; err != nil {
		return nil, err
	}
	byID := make(map[int64]model.Title, len(list))
	for _, t := range list {
		byID[t.ID] = t
	}
	ordered := make([]model.Title, 0, len(ids))
	for _, id := range ids {
		if t, ok := byID[id]; ok {
			ordered = append(ordered, t)
		}
	}
	return ordered, nil
}

func (r *Repo) PlaySources(ctx context.Context, titleID int64) ([]model.PlaySource, error) {
	var list []model.PlaySource
	err := r.DB.WithContext(ctx).
		Preload("Episodes", func(db *gorm.DB) *gorm.DB { return db.Order("idx ASC") }).
		Preload("Source").
		Where("title_id = ?", titleID).
		// 优选：死链(-1)沉底，再按人工权重、响应延迟（越快越前）
		Order("health DESC, weight DESC, latency_ms ASC, id ASC").
		Find(&list).Error
	return list, err
}

// SkipMedian 取某作品众包片头/片尾打点的中位数（秒）。无数据返回 0,0。
func (r *Repo) SkipMedian(ctx context.Context, titleID int64) (introEnd, outroStart int) {
	var row struct {
		IntroEnd   float64
		OutroStart float64
	}
	r.DB.WithContext(ctx).Raw(`
		SELECT
		  COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY intro_end)   FILTER (WHERE intro_end   > 0), 0) AS intro_end,
		  COALESCE(percentile_cont(0.5) WITHIN GROUP (ORDER BY outro_start) FILTER (WHERE outro_start > 0), 0) AS outro_start
		FROM skip_markers WHERE title_id = ?`, titleID).Scan(&row)
	return int(row.IntroEnd + 0.5), int(row.OutroStart + 0.5)
}

// UpsertSkip 用户提交/更新片头片尾打点。
func (r *Repo) UpsertSkip(ctx context.Context, titleID, uid int64, introEnd, outroStart int) error {
	return r.DB.WithContext(ctx).Exec(`
		INSERT INTO skip_markers (title_id, user_id, intro_end, outro_start)
		VALUES (?, ?, ?, ?)
		ON CONFLICT (title_id, user_id) WHERE user_id IS NOT NULL
		DO UPDATE SET intro_end = EXCLUDED.intro_end, outro_start = EXCLUDED.outro_start, created_at = now()`,
		titleID, uid, introEnd, outroStart).Error
}

// SiblingSeasons 返回同系列（同 norm_title + 同类型）的各季作品，按季号排序（用于详情季切换）。
func (r *Repo) SiblingSeasons(ctx context.Context, normTitle string, kind int16) ([]model.Title, error) {
	if normTitle == "" {
		return nil, nil
	}
	var list []model.Title
	err := r.DB.WithContext(ctx).
		Where("norm_title = ? AND kind = ? AND status = 1", normTitle, kind).
		Order("season ASC, year ASC").Find(&list).Error
	return list, err
}

func (r *Repo) Aliases(ctx context.Context, titleID int64) ([]string, error) {
	var aliases []string
	err := r.DB.WithContext(ctx).Model(&model.TitleAlias{}).
		Where("title_id = ?", titleID).Distinct().Pluck("alias", &aliases).Error
	return aliases, err
}

// GenresByKind 返回某类型下实际用到的题材（子分类筛选用）。kind=0 表示全部。
func (r *Repo) GenresByKind(ctx context.Context, kind int16) ([]model.Genre, error) {
	var ids []int64
	r.DB.WithContext(ctx).Raw(
		`SELECT DISTINCT g FROM (SELECT unnest(genre_ids) AS g FROM titles WHERE status = 1 AND (? = 0 OR kind = ?)) x WHERE g > 0`,
		kind, kind).Scan(&ids)
	if len(ids) == 0 {
		return nil, nil
	}
	var gs []model.Genre
	err := r.DB.WithContext(ctx).Where("id IN ?", ids).Order("id").Find(&gs).Error
	return gs, err
}

// TagsByKind 取该类型下最常见的标签（来自 vod_class）。
func (r *Repo) TagsByKind(ctx context.Context, kind int16) []string {
	out := []string{}
	r.DB.WithContext(ctx).Raw(`
		SELECT tag FROM (SELECT unnest(tags) AS tag FROM titles WHERE status = 1 AND (? = 0 OR kind = ?)) x
		WHERE tag <> '' GROUP BY tag ORDER BY count(*) DESC LIMIT 30`, kind, kind).Scan(&out)
	return out
}


func (r *Repo) Genres(ctx context.Context, ids []int64) ([]model.Genre, error) {
	if len(ids) == 0 {
		return nil, nil
	}
	var gs []model.Genre
	err := r.DB.WithContext(ctx).Where("id IN ?", ids).Find(&gs).Error
	return gs, err
}

// MergeTitles 把 from 作品并入 to（移动播放源/剧集/别名/采集记录，删除 from，重算 to 聚合）。
func (r *Repo) MergeTitles(ctx context.Context, fromID, toID int64) error {
	if fromID == toID {
		return nil
	}
	return r.DB.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		// 删除会与 to 冲突的重复播放源（同 源+线路），其余迁移
		tx.Exec(`DELETE FROM play_sources p WHERE p.title_id = ? AND EXISTS (
			SELECT 1 FROM play_sources q WHERE q.title_id = ? AND q.source_id = p.source_id AND q.flag = p.flag)`,
			fromID, toID)
		tx.Exec(`UPDATE episodes SET title_id = ? WHERE title_id = ?`, toID, fromID)
		tx.Exec(`UPDATE play_sources SET title_id = ? WHERE title_id = ?`, toID, fromID)
		tx.Exec(`UPDATE source_items SET title_id = ?, needs_review = false WHERE title_id = ?`, toID, fromID)
		tx.Exec(`INSERT INTO title_aliases (title_id, alias, norm_alias, lang, source)
			SELECT ?, alias, norm_alias, lang, source FROM title_aliases WHERE title_id = ?
			ON CONFLICT (title_id, norm_alias) DO NOTHING`, toID, fromID)
		tx.Exec(`DELETE FROM title_aliases WHERE title_id = ?`, fromID)
		tx.Exec(`DELETE FROM titles WHERE id = ?`, fromID)
		tx.Exec(`UPDATE titles t SET
			source_count = (SELECT count(DISTINCT source_id) FROM play_sources WHERE title_id = t.id),
			latest_episode = COALESCE((SELECT max(episode_count) FROM play_sources WHERE title_id = t.id), 0),
			updated_at = now() WHERE t.id = ?`, toID)
		return nil
	})
}

// DBSearch 是 Meili 不可用时的 pg_trgm 兜底搜索。
func (r *Repo) DBSearch(ctx context.Context, query string, kind int16, page, size int) ([]model.Title, int64, error) {
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 60 {
		size = 24
	}
	// pg_trgm 对中文无效（连相同串相似度都为 0），兜底改用 ILIKE 子串匹配，保证中文可搜
	like := "%" + query + "%"
	q := r.DB.WithContext(ctx).Model(&model.Title{}).
		Where("status = 1").
		Where("name ILIKE ? OR norm_title ILIKE ? OR id IN (SELECT title_id FROM title_aliases WHERE alias ILIKE ?)",
			like, like, like)
	if kind > 0 {
		q = q.Where("kind = ?", kind)
	}
	var total int64
	q.Count(&total)
	var list []model.Title
	err := q.Order("popularity DESC, vote_count DESC").
		Offset((page - 1) * size).Limit(size).Find(&list).Error
	return list, total, err
}
