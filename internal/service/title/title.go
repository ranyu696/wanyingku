// Package title 是作品读取服务：列表/详情/搜索，带 Redis 缓存与 Meili→DB 搜索兜底。
package title

import (
	"context"
	"fmt"
	"time"

	"github.com/xiaoxin/cms/internal/cache"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/internal/repository"
	"github.com/xiaoxin/cms/internal/service/search"
	"github.com/xiaoxin/cms/pkg/aiprovider"
)

type Service struct {
	repo   *repository.Repo
	cache  *cache.Cache
	search *search.Service
	ai     aiprovider.Provider
}

func New(repo *repository.Repo, c *cache.Cache, s *search.Service, ai aiprovider.Provider) *Service {
	return &Service{repo: repo, cache: c, search: s, ai: ai}
}

// ListResult 列表结果。
type ListResult struct {
	List  []model.Title `json:"list"`
	Total int64         `json:"total"`
}

// DetailDTO 详情：规范作品 + 题材 + 别名 + 合并后的多播放源（去重价值出口）。
type DetailDTO struct {
	*model.Title
	Genres      []model.Genre      `json:"genres"`
	Aliases     []string           `json:"aliases"`
	PlaySources []model.PlaySource `json:"play_sources"`
	Seasons     []model.Title      `json:"seasons,omitempty"` // 同系列各季（用于季切换）
}

func (s *Service) List(ctx context.Context, f repository.TitleFilter) (*ListResult, error) {
	key := fmt.Sprintf("t:list:%d:%d:%d:%s:%s:%s:%d:%t:%d:%d", f.Kind, f.Genre, f.Year, f.Region, f.Tag, f.Sort, f.Adult, f.DoubanOnly, f.Page, f.Size)
	var out ListResult
	if ok, _ := s.cache.GetJSON(ctx, key, &out); ok {
		if out.List == nil {
			out.List = []model.Title{}
		}
		return &out, nil
	}
	list, total, err := s.repo.ListTitles(ctx, f)
	if err != nil {
		return nil, err
	}
	if list == nil {
		list = []model.Title{} // 避免 nil slice 序列化成 null，前端 .length 崩溃
	}
	out = ListResult{List: list, Total: total}
	s.cache.SetJSON(ctx, key, out, 5*time.Minute)
	return &out, nil
}

// Related 相关推荐。
func (s *Service) Related(ctx context.Context, id int64, limit int) ([]model.Title, error) {
	t, err := s.repo.GetTitle(ctx, id)
	if err != nil {
		return nil, err
	}
	list, err := s.repo.RelatedTitles(ctx, t, limit)
	if err != nil {
		return nil, err
	}
	if list == nil {
		list = []model.Title{}
	}
	return list, nil
}

// PersonTitles 演员/导演作品列表。
func (s *Service) PersonTitles(ctx context.Context, name string, page, size int) (*ListResult, error) {
	list, total, err := s.repo.PersonTitles(ctx, name, page, size)
	if err != nil {
		return nil, err
	}
	if list == nil {
		list = []model.Title{}
	}
	return &ListResult{List: list, Total: total}, nil
}

// Recommend 个性化推荐（为你推荐）：基于用户题材偏好召回，冷启动降级为热门。
func (s *Service) Recommend(ctx context.Context, userID int64, limit int) ([]model.Title, error) {
	if limit <= 0 {
		limit = 12
	}
	list, err := s.repo.RecommendForUser(ctx, userID, limit)
	if err != nil {
		return nil, err
	}
	if len(list) == 0 {
		// 新用户无历史/收藏：退回全站热门，保证首页始终有内容
		res, e := s.List(ctx, repository.TitleFilter{Sort: "popular", Page: 1, Size: limit})
		if e != nil {
			return []model.Title{}, nil
		}
		return res.List, nil
	}
	return list, nil
}

// SkipMarker 取众包片头/片尾打点中位数（秒）。
func (s *Service) SkipMarker(ctx context.Context, titleID int64) (introEnd, outroStart int) {
	return s.repo.SkipMedian(ctx, titleID)
}

// SubmitSkip 用户提交片头/片尾打点。
func (s *Service) SubmitSkip(ctx context.Context, titleID, uid int64, introEnd, outroStart int) error {
	return s.repo.UpsertSkip(ctx, titleID, uid, introEnd, outroStart)
}

// GetRandom 随机一部（今天看点啥）。
func (s *Service) GetRandom(ctx context.Context, kind int16, genre int64) (*model.Title, error) {
	return s.repo.RandomTitle(ctx, kind, genre)
}

func (s *Service) Detail(ctx context.Context, id int64) (*DetailDTO, error) {
	key := fmt.Sprintf("t:detail:%d", id)
	var out DetailDTO
	if ok, _ := s.cache.GetJSON(ctx, key, &out); ok && out.Title != nil {
		return &out, nil
	}
	t, err := s.repo.GetTitle(ctx, id)
	if err != nil {
		return nil, err
	}
	ps, _ := s.repo.PlaySources(ctx, id)
	aliases, _ := s.repo.Aliases(ctx, id)
	genres, _ := s.repo.Genres(ctx, []int64(t.GenreIDs))
	seasons, _ := s.repo.SiblingSeasons(ctx, t.NormTitle, t.Kind)
	if len(seasons) <= 1 {
		seasons = nil // 只有一季就不展示切换
	}

	out = DetailDTO{Title: t, Genres: genres, Aliases: aliases, PlaySources: ps, Seasons: seasons}
	s.cache.SetJSON(ctx, key, out, 10*time.Minute)
	return &out, nil
}

// InvalidateDetail 详情变更后清缓存（采集更新可调用）。
func (s *Service) InvalidateDetail(ctx context.Context, id int64) {
	s.cache.Del(ctx, fmt.Sprintf("t:detail:%d", id))
}

// Search 优先 Meili，失败/未启用回退 pg_trgm。
func (s *Service) Search(ctx context.Context, query string, kind int16, sort string, page, size int) (*ListResult, error) {
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 60 {
		size = 24
	}
	if s.search.Enabled() {
		meiliSort := ""
		switch sort {
		case "latest":
			meiliSort = "updated_at:desc"
		case "rating":
			meiliSort = "vote_average:desc"
		case "year":
			meiliSort = "year:desc"
		}
		ids, total, err := s.search.Search(ctx, search.SearchOptions{
			Query: query, Kind: kind, Sort: meiliSort,
			Offset: (page - 1) * size, Limit: size,
		})
		if err == nil {
			list, _ := s.repo.TitlesByIDs(ctx, ids)
			return &ListResult{List: list, Total: total}, nil
		}
	}
	// 兜底：数据库三元组搜索
	list, total, err := s.repo.DBSearch(ctx, query, kind, page, size)
	if err != nil {
		return nil, err
	}
	return &ListResult{List: list, Total: total}, nil
}

// SemanticSearch AI 语义搜索：把查询向量化后按余弦距离召回。
// 未配置 embedding 或向量化失败时，自动降级为关键词搜索。
func (s *Service) SemanticSearch(ctx context.Context, query string, kind int16, limit int) (*ListResult, error) {
	if limit < 1 || limit > 60 {
		limit = 24
	}
	if !s.ai.Enabled() {
		return s.Search(ctx, query, kind, "", 1, limit)
	}
	vecs, err := s.ai.Embed(ctx, []string{query})
	if err != nil || len(vecs) == 0 {
		return s.Search(ctx, query, kind, "", 1, limit)
	}
	list, err := s.repo.SemanticSearch(ctx, vecs[0], kind, limit)
	if err != nil {
		return nil, err
	}
	if list == nil {
		list = []model.Title{}
	}
	return &ListResult{List: list, Total: int64(len(list))}, nil
}
