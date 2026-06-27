// Package resolve 是去重归类引擎（实体解析）。
//
// 目标：把不同采集源里「同一部影片因译名/语种/写法不同」被拆成多条的问题，
// 通过四层漏斗解析到同一个规范作品(title)，实现多源合并、单条展示。
//
// 漏斗（高精度优先，逐层放宽）：
//  1. 本地精确归一化命中   —— norm_title / 别名完全相等（最便宜的跨源去重）
//  2. TMDB 别名匹配        —— 用 TMDB id 作为聚类主键，不同译名天然合并（权威）
//  3. pg_trgm 模糊召回     —— similarity 高于自动合并阈值则合并
//  4. 向量召回 + LLM 仲裁   —— 灰区交给 embedding 相似度 / 大模型判定（可选，未配置自动跳过）
//     兜底：新建规范作品，灰区近邻标记 needs_review 待人工。
package resolve

import (
	"context"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/pkg/aiprovider"
	"github.com/xiaoxin/cms/pkg/storage"
	"github.com/xiaoxin/cms/pkg/textutil"
	"github.com/xiaoxin/cms/pkg/tmdb"
	"gorm.io/gorm"
)

// Input 一条待归类的采集记录的提炼信息。
type Input struct {
	Name      string
	NormTitle string
	Kind      int16
	Adult     bool // 成人(里番/伦理)：只和成人合并、不匹配主流 TMDB；与同名非成人视为独立作品
	Season    int
	Year      int
	Overview  string
	Director  string
	Actors    string
	Area      string
	Pic       string
}

// Result 归类结果。
type Result struct {
	TitleID     int64
	Method      int16
	Confidence  float32
	NeedsReview bool
	Created     bool
	Title       *model.Title
}

type Engine struct {
	db    *gorm.DB
	tmdb  *tmdb.Client // 可为 nil（TMDB 未启用）
	ai    aiprovider.Provider
	store storage.Storage
	cfg   config.Resolve
	aiCfg config.AI
	mu    sync.Mutex // 保护非 TMDB 路径的「查重-新建」临界区
}

func New(db *gorm.DB, tmdbClient *tmdb.Client, ai aiprovider.Provider, cfg config.Resolve, aiCfg config.AI) *Engine {
	if ai == nil {
		ai = aiprovider.Noop{}
	}
	return &Engine{db: db, tmdb: tmdbClient, ai: ai, store: storage.Noop{}, cfg: cfg, aiCfg: aiCfg}
}

// WithStorage 注入图床（转存海报到自有 S3）。s 为 nil 时保持 Noop。
func (e *Engine) WithStorage(s storage.Storage) *Engine {
	if s != nil {
		e.store = s
	}
	return e
}

type candidate struct {
	ID    int64
	Score float32
}

// Resolve 把一条采集记录解析到一个规范作品。
func (e *Engine) Resolve(ctx context.Context, in Input) (*Result, error) {
	if in.NormTitle == "" {
		in.NormTitle = textutil.Normalize(in.Name)
	}
	if in.Season == 0 {
		in.Season = textutil.ParseSeason(in.Name)
	}
	tol := e.cfg.YearTolerance

	// ---- 第 1 层：本地精确归一化命中（最便宜的跨源去重）----
	if id, ok := e.exactLocal(ctx, in, tol); ok {
		t, _ := e.getTitle(ctx, id)
		return &Result{TitleID: id, Method: model.MatchFuzzy, Confidence: 0.99, Title: t}, nil
	}

	// ---- 第 2 层：TMDB 别名匹配（权威聚类主键）----
	// 成人内容(里番/伦理)跳过 TMDB：TMDB 只收录主流片，按名匹配会把里番「鬼作秀」挂到主流 Creepshow 上、盗其评分海报。
	if e.tmdb != nil && e.cfg.EnableTMDB && !in.Adult {
		if tmdbID, conf, isTV := e.tmdbMatch(ctx, in); tmdbID > 0 {
			if id, ok := e.findByTMDB(ctx, in.Kind, tmdbID, in.Season); ok {
				t, _ := e.getTitle(ctx, id)
				return &Result{TitleID: id, Method: model.MatchTMDB, Confidence: conf, Title: t}, nil
			}
			if t, err := e.createFromTMDB(ctx, tmdbID, isTV, conf, in); err == nil && t != nil {
				return &Result{TitleID: t.ID, Method: model.MatchTMDB, Confidence: conf, Created: true, Title: t}, nil
			}
			// TMDB 创建失败则继续往下走兜底
		}
	}

	// ---- 第 3/4 层：模糊 + 向量候选 ----
	cands := e.fuzzyCandidates(ctx, in, tol)
	if e.ai.Enabled() && e.aiCfg.VectorEnabled {
		cands = mergeCandidates(cands, e.vectorCandidates(ctx, in))
	}
	if best, ok := topCandidate(cands); ok {
		if best.Score >= float32(e.cfg.AutoMergeThreshold) {
			t, _ := e.getTitle(ctx, best.ID)
			method := model.MatchFuzzy
			return &Result{TitleID: best.ID, Method: int16(method), Confidence: best.Score, Title: t}, nil
		}
		// 灰区：LLM 仲裁
		if best.Score >= float32(e.cfg.LLMReviewLow) && e.ai.Enabled() && e.aiCfg.LLMEnabled {
			if t, _ := e.getTitle(ctx, best.ID); t != nil && e.llmSame(ctx, in, t) {
				return &Result{TitleID: t.ID, Method: model.MatchLLM, Confidence: best.Score, Title: t}, nil
			}
		}
		// 接近但未合并：新建并标记待人工复核（可能是同一部）
		if best.Score >= float32(e.cfg.FuzzyThreshold) {
			t, err := e.createFromRaw(ctx, in, model.MatchNone, best.Score)
			if err != nil {
				return nil, err
			}
			return &Result{TitleID: t.ID, Method: model.MatchNone, Confidence: best.Score, NeedsReview: true, Created: true, Title: t}, nil
		}
	}

	// ---- 兜底：全新作品 ----
	t, err := e.createFromRaw(ctx, in, model.MatchNone, 0)
	if err != nil {
		return nil, err
	}
	return &Result{TitleID: t.ID, Method: model.MatchNone, Confidence: 0, Created: true, Title: t}, nil
}

// YearTolFor 按类型决定年份容差：电影/电视剧有翻拍，按年份区分（避免误并）；
// 动漫/综艺/纪录/短剧 同名同季基本是同一部，但各源对年份常不一致（起始年 vs 当前年），放宽到不卡年份。
func YearTolFor(kind int16, base int) int {
	switch kind {
	case model.KindMovie, model.KindTV:
		return base
	default:
		return 9999
	}
}

// exactLocal 在 titles.norm_title 与 title_aliases.norm_alias 上做精确命中。
func (e *Engine) exactLocal(ctx context.Context, in Input, tol int) (int64, bool) {
	if in.NormTitle == "" {
		return 0, false
	}
	yt := YearTolFor(in.Kind, tol)
	var id int64
	err := e.db.WithContext(ctx).Raw(`
		SELECT id FROM titles
		WHERE kind = ? AND season = ? AND norm_title = ? AND norm_title <> '' AND adult = ?
		  AND (? = 0 OR year = 0 OR abs(year - ?) <= ?)
		ORDER BY (year = ?) DESC, popularity DESC
		LIMIT 1`,
		in.Kind, in.Season, in.NormTitle, in.Adult, in.Year, in.Year, yt, in.Year).Row().Scan(&id)
	if err == nil && id > 0 {
		return id, true
	}
	id = 0
	err = e.db.WithContext(ctx).Raw(`
		SELECT t.id FROM title_aliases a JOIN titles t ON t.id = a.title_id
		WHERE t.kind = ? AND t.season = ? AND a.norm_alias = ? AND a.norm_alias <> '' AND t.adult = ?
		  AND (? = 0 OR t.year = 0 OR abs(t.year - ?) <= ?)
		LIMIT 1`,
		in.Kind, in.Season, in.NormTitle, in.Adult, in.Year, in.Year, yt).Row().Scan(&id)
	if err == nil && id > 0 {
		return id, true
	}
	return 0, false
}

func (e *Engine) findByTMDB(ctx context.Context, kind int16, tmdbID, season int) (int64, bool) {
	var id int64
	err := e.db.WithContext(ctx).Raw(
		`SELECT id FROM titles WHERE tmdb_id = ? AND kind = ? AND season = ? LIMIT 1`,
		tmdbID, kind, season).Row().Scan(&id)
	return id, err == nil && id > 0
}

// fuzzyCandidates 召回近似候选（标题 + 别名）。
// 注意：pg_trgm 对中文不生成有效三元组（连相同中文串 similarity 都为 0），无法用于中文模糊匹配，
// 故改为按 kind+season+year 窗口取候选，再用 Go 端 textutil.Similarity（支持子串包含 + rune 三元组）打分。
func (e *Engine) fuzzyCandidates(ctx context.Context, in Input, tol int) []candidate {
	if in.NormTitle == "" {
		return nil
	}
	if in.Kind == model.KindSports {
		return nil // 体育赛事每场唯一，不做模糊去重（否则相似赛名互相误判进复核队列）
	}
	yt := YearTolFor(in.Kind, tol)
	type row struct {
		ID   int64
		Norm string
	}

	var trows []row
	e.db.WithContext(ctx).Raw(`
		SELECT id, norm_title AS norm
		FROM titles
		WHERE kind = ? AND season = ? AND norm_title <> '' AND adult = ?
		  AND (? = 0 OR year = 0 OR abs(year - ?) <= ?)
		LIMIT 2000`,
		in.Kind, in.Season, in.Adult, in.Year, in.Year, yt).Scan(&trows)

	var arows []row
	e.db.WithContext(ctx).Raw(`
		SELECT a.title_id AS id, a.norm_alias AS norm
		FROM title_aliases a JOIN titles t ON t.id = a.title_id
		WHERE t.kind = ? AND t.season = ? AND a.norm_alias <> '' AND t.adult = ?
		  AND (? = 0 OR t.year = 0 OR abs(t.year - ?) <= ?)
		LIMIT 2000`,
		in.Kind, in.Season, in.Adult, in.Year, in.Year, yt).Scan(&arows)

	best := map[int64]float32{}
	score := func(rs []row) {
		for _, r := range rs {
			if textutil.DifferentInstallment(in.NormTitle, r.Norm) {
				continue // 尾号不同的续作/季，不算同一部
			}
			if s := float32(textutil.Similarity(in.NormTitle, r.Norm)); s > best[r.ID] {
				best[r.ID] = s
			}
		}
	}
	score(trows)
	score(arows)

	out := make([]candidate, 0, len(best))
	for id, s := range best {
		if s >= float32(e.cfg.FuzzyThreshold) {
			out = append(out, candidate{ID: id, Score: s})
		}
	}
	return out
}

// BestDuplicate 给一条已存在作品 t，在库里找最像的「另一条」(排除自身)，返回候选 id 与相似分。
// 复用采集期同一套模糊召回(标题+别名, 含续作/不同季保护)，供离线批量复核去重用。
func (e *Engine) BestDuplicate(ctx context.Context, t *model.Title) (int64, float32, bool) {
	in := Input{
		Name:      t.Name,
		NormTitle: t.NormTitle,
		Kind:      t.Kind,
		Adult:     t.Adult,
		Season:    int(t.Season),
		Year:      t.Year,
	}
	if in.NormTitle == "" {
		in.NormTitle = textutil.Normalize(in.Name)
	}
	cands := e.fuzzyCandidates(ctx, in, e.cfg.YearTolerance)
	kept := cands[:0]
	for _, c := range cands {
		if c.ID != t.ID { // 排除自身
			kept = append(kept, c)
		}
	}
	best, ok := topCandidate(kept)
	if !ok {
		return 0, 0, false
	}
	return best.ID, best.Score, true
}

// vectorCandidates 用 pgvector 余弦近邻召回（需 002 迁移 + 嵌入提供方）。
func (e *Engine) vectorCandidates(ctx context.Context, in Input) []candidate {
	text := strings.TrimSpace(in.Name + " " + in.Overview)
	if text == "" {
		return nil
	}
	vecs, err := e.ai.Embed(ctx, []string{truncate(text, 800)})
	if err != nil || len(vecs) == 0 {
		return nil
	}
	var rows []candidate
	e.db.WithContext(ctx).Raw(`
		SELECT te.title_id AS id, (1 - (te.embedding <=> ?::vector))::real AS score
		FROM title_embeddings te JOIN titles t ON t.id = te.title_id
		WHERE t.kind = ?
		ORDER BY te.embedding <=> ?::vector
		LIMIT 8`,
		formatVector(vecs[0]), in.Kind, formatVector(vecs[0])).Scan(&rows)
	// 向量分数略降权，避免压过精确/TMDB
	for i := range rows {
		rows[i].Score *= 0.97
	}
	return rows
}

func (e *Engine) getTitle(ctx context.Context, id int64) (*model.Title, error) {
	var t model.Title
	if err := e.db.WithContext(ctx).First(&t, id).Error; err != nil {
		return nil, err
	}
	return &t, nil
}

// ---- 工具 ----

func mergeCandidates(a, b []candidate) []candidate {
	m := make(map[int64]float32, len(a)+len(b))
	for _, c := range a {
		if c.Score > m[c.ID] {
			m[c.ID] = c.Score
		}
	}
	for _, c := range b {
		if c.Score > m[c.ID] {
			m[c.ID] = c.Score
		}
	}
	out := make([]candidate, 0, len(m))
	for id, s := range m {
		out = append(out, candidate{ID: id, Score: s})
	}
	return out
}

func topCandidate(cs []candidate) (candidate, bool) {
	if len(cs) == 0 {
		return candidate{}, false
	}
	best := cs[0]
	for _, c := range cs[1:] {
		if c.Score > best.Score {
			best = c
		}
	}
	return best, true
}

func formatVector(v []float32) string {
	var b strings.Builder
	b.WriteByte('[')
	for i, x := range v {
		if i > 0 {
			b.WriteByte(',')
		}
		b.WriteString(strconv.FormatFloat(float64(x), 'f', 6, 32))
	}
	b.WriteByte(']')
	return b.String()
}

func truncate(s string, n int) string {
	r := []rune(s)
	if len(r) <= n {
		return s
	}
	return string(r[:n])
}

func absInt(a int) int {
	if a < 0 {
		return -a
	}
	return a
}

func parseDate(s string) *time.Time {
	if len(s) < 10 {
		return nil
	}
	t, err := time.Parse("2006-01-02", s[:10])
	if err != nil {
		return nil
	}
	return &t
}
