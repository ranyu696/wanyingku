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
	http    *resty.Client
	index   string
	enabled bool
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
	return &Service{http: h, index: cfg.Meili.Index, enabled: cfg.Meili.Enabled}
}

func (s *Service) Enabled() bool { return s.enabled }

// EnsureIndex 创建索引并设置可搜索/可过滤/可排序字段（启动时调用，best-effort）。
func (s *Service) EnsureIndex(ctx context.Context) error {
	if !s.enabled {
		return nil
	}
	// 创建索引（已存在会返回任务，忽略错误）
	s.http.R().SetContext(ctx).
		SetBody(map[string]any{"uid": s.index, "primaryKey": "id"}).
		Post("/indexes")

	settings := map[string]any{
		"searchableAttributes": []string{"name", "original_name", "aliases", "overview"},
		"filterableAttributes": []string{"kind", "year", "genre_ids", "source_count"},
		"sortableAttributes":   []string{"popularity", "year", "vote_average", "updated_at", "latest_episode"},
		"rankingRules":         []string{"words", "typo", "proximity", "attribute", "sort", "exactness"},
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
