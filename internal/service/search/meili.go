// Package search 封装 Meilisearch（用 REST API，避免 SDK 版本耦合）。
// Meili 未启用或不可用时，调用方应回退到数据库 pg_trgm 搜索。
package search

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/model"
)

type Service struct {
	http     *resty.Client
	index    string
	enabled  bool
	embedder string         // 非空则启用语义/混合搜索（embedder 名）
	embedCfg map[string]any // Meili embedder 设置（EnsureIndex 时下发）
}

// TitleDoc 写入 Meili 的文档结构。
type TitleDoc struct {
	ID            int64    `json:"id"`
	Name          string   `json:"name"`
	OriginalName  string   `json:"original_name"`
	Aliases       []string `json:"aliases"`
	Year          int      `json:"year"`
	Kind          int16    `json:"kind"`
	Overview      string   `json:"overview"`
	Poster        string   `json:"poster"`
	GenreIDs      []int64  `json:"genre_ids"`
	VoteAverage   float32  `json:"vote_average"`
	Popularity    float32  `json:"popularity"`
	SourceCount   int      `json:"source_count"`
	LatestEpisode int      `json:"latest_episode"`
	UpdatedAt     int64    `json:"updated_at"`
}

func New(cfg *config.Config) *Service {
	h := resty.New().
		SetBaseURL(strings.TrimRight(cfg.Meili.Host, "/")).
		SetTimeout(8*time.Second).
		SetHeader("Content-Type", "application/json")
	if cfg.Meili.APIKey != "" {
		h.SetAuthToken(cfg.Meili.APIKey)
	}
	s := &Service{http: h, index: cfg.Meili.Index, enabled: cfg.Meili.Enabled}
	// 不给 Meili 注册 embedder：搜索只用 Meili 做关键词匹配，语义搜索走独立的 pgvector。
	// 此前给 Meili 配 gemini embedder，会让每篇文档索引时同步向量化(逐条调嵌入 API)，
	// 90k 量级直接拖垮全量重建(只成功 ~1901 篇)，而这些向量根本没被搜索用到。
	// cfg.Meili.Embed* 暂保留以备日后真要上 Meili 混合搜索时重启用。
	return s
}

func (s *Service) Enabled() bool { return s.enabled }

// EnsureIndex 创建索引并设置可搜索/可过滤/可排序字段（启动时调用，best-effort）。
func (s *Service) EnsureIndex(ctx context.Context) error {
	if !s.enabled {
		return nil
	}
	// 索引已存在就不再创建：直接 POST /indexes 会让 Meili 跑一个注定失败的建索引任务并刷 ERROR 日志。
	// 先 GET 探存在，仅 404（或探测失败）时才创建。
	if resp, _ := s.http.R().SetContext(ctx).Get(fmt.Sprintf("/indexes/%s", s.index)); resp == nil || resp.StatusCode() == 404 {
		s.http.R().SetContext(ctx).
			SetBody(map[string]any{"uid": s.index, "primaryKey": "id"}).
			Post("/indexes")
	}

	// 语义搜索：开启实验特性 vectorStore（v1.12 需要；新版已 GA，重复设置无害），并注册 embedder。
	if s.embedder != "" {
		s.http.R().SetContext(ctx).
			SetBody(map[string]any{"vectorStore": true}).
			Patch("/experimental-features")
	}

	settings := map[string]any{
		"searchableAttributes": []string{"name", "original_name", "aliases", "overview"},
		"filterableAttributes": []string{"kind", "year", "genre_ids", "source_count"},
		"sortableAttributes":   []string{"popularity", "year", "vote_average", "updated_at", "latest_episode"},
		"rankingRules":         []string{"words", "typo", "proximity", "attribute", "sort", "exactness"},
	}
	if s.embedder != "" && s.embedCfg != nil {
		settings["embedders"] = map[string]any{s.embedder: s.embedCfg}
	} else {
		// 主动清空历史注册的 embedder：纯文本索引，不再每篇向量化（拖垮全量重建）。
		settings["embedders"] = map[string]any{}
	}
	resp, err := s.http.R().SetContext(ctx).SetBody(settings).
		Patch(fmt.Sprintf("/indexes/%s/settings", s.index))
	if err != nil {
		return err
	}
	if resp.IsError() {
		return fmt.Errorf("meili settings: http %d %s", resp.StatusCode(), resp.String())
	}
	return nil
}

func (s *Service) IndexDocs(ctx context.Context, docs []TitleDoc) error {
	if !s.enabled || len(docs) == 0 {
		return nil
	}
	resp, err := s.http.R().SetContext(ctx).SetBody(docs).
		Post(fmt.Sprintf("/indexes/%s/documents", s.index))
	if err != nil {
		return err
	}
	if resp.IsError() {
		return fmt.Errorf("meili index: http %d %s", resp.StatusCode(), resp.String())
	}
	return nil
}

func (s *Service) DeleteDoc(ctx context.Context, id int64) {
	if !s.enabled {
		return
	}
	s.http.R().SetContext(ctx).Delete(fmt.Sprintf("/indexes/%s/documents/%d", s.index, id))
}

// DeleteAllDocs 清空索引文档（全量重建前调用，确保索引与 DB 一致、无合并/删除遗留的死文档）。
func (s *Service) DeleteAllDocs(ctx context.Context) {
	if !s.enabled {
		return
	}
	s.http.R().SetContext(ctx).Delete(fmt.Sprintf("/indexes/%s/documents", s.index))
}

// SearchOptions 搜索参数。
type SearchOptions struct {
	Query  string
	Kind   int16
	Year   int
	Genre  int64
	Sort   string // 如 "popularity:desc"
	Offset int
	Limit  int
}

type searchResp struct {
	Hits               []TitleDoc `json:"hits"`
	EstimatedTotalHits int64      `json:"estimatedTotalHits"`
}

// Search 返回命中的 title id 顺序与估算总数（详情由 DB 回填，保证数据新鲜）。
func (s *Service) Search(ctx context.Context, opt SearchOptions) ([]int64, int64, error) {
	if !s.enabled {
		return nil, 0, fmt.Errorf("meili disabled")
	}
	var filters []string
	if opt.Kind > 0 {
		filters = append(filters, fmt.Sprintf("kind = %d", opt.Kind))
	}
	if opt.Year > 0 {
		filters = append(filters, fmt.Sprintf("year = %d", opt.Year))
	}
	if opt.Genre > 0 {
		filters = append(filters, fmt.Sprintf("genre_ids = %d", opt.Genre))
	}
	body := map[string]any{
		"q":      opt.Query,
		"limit":  opt.Limit,
		"offset": opt.Offset,
	}
	if len(filters) > 0 {
		body["filter"] = strings.Join(filters, " AND ")
	}
	if opt.Sort != "" {
		body["sort"] = []string{opt.Sort}
	}
	// 关键词搜索走纯关键词匹配。语义搜索是独立路径（mode=semantic → AI embedding + pgvector），
	// 不在这里掺 hybrid——此前无条件 semanticRatio=0.5 会把精确匹配(如「痴迷」)冲散、命中数暴涨。
	var out searchResp
	resp, err := s.http.R().SetContext(ctx).SetBody(body).SetResult(&out).
		Post(fmt.Sprintf("/indexes/%s/search", s.index))
	if err != nil {
		return nil, 0, err
	}
	if resp.IsError() {
		return nil, 0, fmt.Errorf("meili search: http %d", resp.StatusCode())
	}
	ids := make([]int64, len(out.Hits))
	for i, h := range out.Hits {
		ids[i] = h.ID
	}
	return ids, out.EstimatedTotalHits, nil
}

// BuildDoc 由规范作品 + 别名构建 Meili 文档。
func BuildDoc(t *model.Title, aliases []string) TitleDoc {
	return TitleDoc{
		ID:            t.ID,
		Name:          t.Name,
		OriginalName:  t.OriginalName,
		Aliases:       aliases,
		Year:          t.Year,
		Kind:          t.Kind,
		Overview:      t.Overview,
		Poster:        t.Poster,
		GenreIDs:      []int64(t.GenreIDs),
		VoteAverage:   t.VoteAverage,
		Popularity:    t.Popularity,
		SourceCount:   t.SourceCount,
		LatestEpisode: t.LatestEpisode,
		UpdatedAt:     t.UpdatedAt.Unix(),
	}
}
