package resolve

import (
	"context"
	"fmt"
	"strings"

	"github.com/lib/pq"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/pkg/slug"
	"github.com/xiaoxin/cms/pkg/textutil"
	"github.com/xiaoxin/cms/pkg/tmdb"
)

// createFromTMDB 用 TMDB 详情创建规范作品（含别名/题材/可选向量）。
// 季作为独立作品：kind/season 来自 in；同一剧不同季共享 tmdb_id，唯一键含 season。
func (e *Engine) createFromTMDB(ctx context.Context, tmdbID int, isTV bool, conf float32, in Input) (*model.Title, error) {
	kind := in.Kind
	e.mu.Lock()
	defer e.mu.Unlock()
	// 锁内复查，避免并发重复创建同一 (tmdb_id, kind, season)
	if id, ok := e.findByTMDB(ctx, kind, tmdbID, in.Season); ok {
		return e.getTitle(ctx, id)
	}

	var detail *tmdb.Detail
	var err error
	if isTV {
		detail, err = e.tmdb.TVDetail(ctx, tmdbID)
	} else {
		detail, err = e.tmdb.MovieDetail(ctx, tmdbID)
	}
	if err != nil {
		return nil, err
	}

	name := strings.TrimSpace(detail.DisplayName())
	if name == "" {
		name = textutil.CleanName(in.Name)
	}

	genreIDs := make(pq.Int64Array, 0, len(detail.Genres))
	for _, g := range detail.Genres {
		genreIDs = append(genreIDs, int64(g.ID))
		e.upsertGenre(ctx, g.ID, g.Name)
	}

	country := make(pq.StringArray, 0)
	for _, c := range detail.ProductionCountries {
		country = append(country, c.Name)
	}
	if len(country) == 0 {
		for _, c := range detail.OriginCountry {
			country = append(country, c)
		}
	}
	langs := pq.StringArray{}
	if detail.OriginalLanguage != "" {
		langs = pq.StringArray{detail.OriginalLanguage}
	}
	runtime := detail.Runtime
	if runtime == 0 && len(detail.EpisodeRunTime) > 0 {
		runtime = detail.EpisodeRunTime[0]
	}

	// 季作为独立作品：有源封面时优先用源封面（每季不同），否则用 TMDB 海报
	posterURL := e.tmdb.Img(detail.PosterPath, "w500")
	if in.Season > 0 && in.Pic != "" {
		posterURL = in.Pic
	}
	posterImg := e.store.Rehost(ctx, posterURL)
	backdropImg := e.store.Rehost(ctx, e.tmdb.Img(detail.BackdropPath, "original"))
	tid := tmdbID
	t := &model.Title{
		Kind:             kind,
		Season:           int16(in.Season),
		TmdbID:           &tid,
		ImdbID:           detail.IMDb(),
		Name:             name,
		OriginalName:     detail.OrigName(),
		NormTitle:        in.NormTitle,
		Year:             detail.Year(),
		ReleaseDate:      parseDate(firstNonEmpty(detail.ReleaseDate, detail.FirstAirDate)),
		Overview:         detail.Overview,
		Tagline:          detail.Tagline,
		Director:         in.Director,
		Actors:           in.Actors,
		Area:             in.Area,
		Poster:           posterImg.URL,
		PosterBlurhash:   posterImg.BlurHash,
		Backdrop:         backdropImg.URL,
		BackdropBlurhash: backdropImg.BlurHash,
		GenreIDs:         genreIDs,
		Tags:            pq.StringArray{}, // 非空，避免 NOT NULL 约束（题材标签后续 retag 写入）
		Country:         country,
		Languages:       langs,
		Runtime:         runtime,
		VoteAverage:     detail.VoteAverage,
		VoteCount:       detail.VoteCount,
		Popularity:      detail.Popularity,
		Status:          1,
		MatchStatus:     model.MatchTMDB,
		MatchConfidence: conf,
		TotalEpisodes:   detail.NumberOfEpisodes,
	}
	if err := e.db.WithContext(ctx).Create(t).Error; err != nil {
		return nil, err
	}
	e.ensureSlug(ctx, t)

	aliases := detail.AllAliases()
	aliases = append(aliases, in.Name)
	e.addAliases(ctx, t.ID, aliases, model.AliasFromTMDB)
	e.maybeEmbed(ctx, t)
	return t, nil
}

// createFromRaw 用采集原始信息创建作品（未命中 TMDB 时的兜底）。
func (e *Engine) createFromRaw(ctx context.Context, in Input, matchStatus int16, conf float32) (*model.Title, error) {
	e.mu.Lock()
	defer e.mu.Unlock()
	// 锁内复查精确命中，避免并发重复创建
	if id, ok := e.exactLocal(ctx, in, e.cfg.YearTolerance); ok {
		return e.getTitle(ctx, id)
	}

	name := textutil.CleanName(in.Name)
	if name == "" {
		name = in.Name
	}
	posterImg := e.store.Rehost(ctx, in.Pic)
	t := &model.Title{
		Kind:            in.Kind,
		Season:          int16(in.Season),
		Name:            name,
		NormTitle:       in.NormTitle,
		Adult:           in.Adult,
		Year:            in.Year,
		Overview:        in.Overview,
		Director:        in.Director,
		Actors:          in.Actors,
		Area:            in.Area,
		Poster:          posterImg.URL,
		PosterBlurhash:  posterImg.BlurHash,
		GenreIDs:        pq.Int64Array{},
		Tags:            pq.StringArray{}, // 非空，避免 NOT NULL 约束
		Country:         pq.StringArray{},
		Languages:       pq.StringArray{},
		Status:          1,
		MatchStatus:     matchStatus,
		MatchConfidence: conf,
	}
	if err := e.db.WithContext(ctx).Create(t).Error; err != nil {
		return nil, err
	}
	e.ensureSlug(ctx, t)
	e.addAliases(ctx, t.ID, []string{in.Name, name}, model.AliasFromSource)
	e.maybeEmbed(ctx, t)
	return t, nil
}

// ensureSlug 给作品生成唯一拼音 slug（冲突追加 -2/-3…），失败则留空（前端回退数字 id）。
func (e *Engine) ensureSlug(ctx context.Context, t *model.Title) {
	base := slug.Make(t.Name)
	if base == "" {
		return
	}
	s := base
	for i := 2; i <= 8; i++ {
		res := e.db.WithContext(ctx).Exec(
			`UPDATE titles SET slug = ? WHERE id = ? AND NOT EXISTS (SELECT 1 FROM titles WHERE slug = ?)`,
			s, t.ID, s)
		if res.Error == nil && res.RowsAffected > 0 {
			t.Slug = s
			return
		}
		s = fmt.Sprintf("%s-%d", base, i)
	}
}

// BackfillSlugs 给所有空 slug 的作品补 slug。返回成功补上的条数。
func (e *Engine) BackfillSlugs(ctx context.Context) int {
	var titles []model.Title
	e.db.WithContext(ctx).Where("slug = ''").Order("id").Find(&titles)
	n := 0
	for i := range titles {
		e.ensureSlug(ctx, &titles[i])
		if titles[i].Slug != "" {
			n++
		}
	}
	return n
}

// BackfillOverview 清洗历史 overview 里夹带的 HTML 标签（<p>/<br>/&nbsp; 等）。
// 仅扫描含 < 或 & 的行，逐条用 CleanHTML 重写；清洗后无变化的跳过。
func (e *Engine) BackfillOverview(ctx context.Context) int {
	type row struct {
		ID       int64
		Overview string
	}
	var rows []row
	e.db.WithContext(ctx).Model(&model.Title{}).
		Where("overview ~ '<' OR overview ~ '&'").
		Order("id").Find(&rows)
	n := 0
	for _, r := range rows {
		cleaned := textutil.CleanHTML(r.Overview)
		if cleaned == r.Overview {
			continue
		}
		e.db.WithContext(ctx).Model(&model.Title{}).
			Where("id = ?", r.ID).Update("overview", cleaned)
		n++
	}
	return n
}

func (e *Engine) addAliases(ctx context.Context, titleID int64, names []string, source int16) {
	seen := map[string]bool{}
	for _, n := range names {
		n = strings.TrimSpace(n)
		if n == "" {
			continue
		}
		na := textutil.Normalize(n)
		if na == "" || seen[na] {
			continue
		}
		seen[na] = true
		e.db.WithContext(ctx).Exec(
			`INSERT INTO title_aliases(title_id, alias, norm_alias, lang, source)
			 VALUES (?, ?, ?, ?, ?) ON CONFLICT (title_id, norm_alias) DO NOTHING`,
			titleID, n, na, textutil.DetectLang(n), source)
	}
}

// TMDB 个别剧集类目无中文译名（数据缺口），手动补译。
var genreZH = map[string]string{
	"Sci-Fi & Fantasy":   "科幻奇幻",
	"War & Politics":     "战争政治",
	"Action & Adventure": "动作冒险",
}

func (e *Engine) upsertGenre(ctx context.Context, id int, name string) {
	if id == 0 {
		return
	}
	if zh, ok := genreZH[name]; ok {
		name = zh
	}
	e.db.WithContext(ctx).Exec(
		`INSERT INTO genres(id, name) VALUES (?, ?) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name`,
		id, name)
}

// EmbedAll 给全部作品补向量（向量层开启时；worker -embed 触发）。返回处理数。
func (e *Engine) EmbedAll(ctx context.Context) int {
	if !e.aiCfg.VectorEnabled || !e.ai.Enabled() {
		return 0
	}
	var ids []int64
	e.db.WithContext(ctx).Model(&model.Title{}).Where("status = 1").Pluck("id", &ids)
	n := 0
	for _, id := range ids {
		var t model.Title
		if e.db.WithContext(ctx).First(&t, id).Error == nil {
			e.maybeEmbed(ctx, &t)
			n++
		}
	}
	return n
}

// maybeEmbed 在向量层开启时计算并写入 title_embeddings（失败静默，不影响主流程）。
func (e *Engine) maybeEmbed(ctx context.Context, t *model.Title) {
	if !e.aiCfg.VectorEnabled || !e.ai.Enabled() {
		return
	}
	text := truncate(strings.TrimSpace(t.Name+" "+t.Overview), 800)
	vecs, err := e.ai.Embed(ctx, []string{text})
	if err != nil || len(vecs) == 0 {
		return
	}
	e.db.WithContext(ctx).Exec(
		`INSERT INTO title_embeddings(title_id, model, embedding) VALUES (?, ?, ?::vector)
		 ON CONFLICT (title_id) DO UPDATE SET embedding = EXCLUDED.embedding, model = EXCLUDED.model, updated_at = now()`,
		t.ID, e.aiCfg.EmbeddingModel, formatVector(vecs[0]))
}

func firstNonEmpty(ss ...string) string {
	for _, s := range ss {
		if s != "" {
			return s
		}
	}
	return ""
}
