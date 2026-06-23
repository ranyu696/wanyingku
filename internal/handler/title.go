package handler

import (
	"context"

	"github.com/labstack/echo/v4"
	"github.com/xiaoxin/cms/internal/middleware"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/internal/repository"
	"github.com/xiaoxin/cms/pkg/response"
)

// Sitemap 返回全部上架作品的 slug/id/更新时间（供 SSR 服务生成 sitemap.xml）。
func (h *Handler) Sitemap(c echo.Context) error {
	type row struct {
		ID        int64  `json:"id"`
		Slug      string `json:"slug"`
		UpdatedAt string `json:"updated_at"`
	}
	var rows []row
	// ponytail: 按主键 id 取（走 PK 索引，廉价、抗写入并发）；站点地图顺序对爬虫无意义。
	// 上限 50000 = sitemap 单文件协议上限；超过需拆分 sitemap index（届时再说）。
	h.DB.WithContext(c.Request().Context()).Raw(
		`SELECT id, slug, to_char(updated_at, 'YYYY-MM-DD') AS updated_at
		 FROM titles WHERE status = 1 ORDER BY id LIMIT 50000`).Scan(&rows)
	return response.OK(c, rows)
}

func (h *Handler) ListTitles(c echo.Context) error {
	f := repository.TitleFilter{
		Kind:   int16(qInt(c, "kind", 0)),
		Genre:  int64(qInt(c, "genre", 0)),
		Year:   qInt(c, "year", 0),
		Region: c.QueryParam("region"),
		Tag:    c.QueryParam("tag"),
		Sort:   c.QueryParam("sort"),
		Adult:  qInt(c, "adult", 0), // 1=仅成人(伦理/里番)
		Page:   qInt(c, "page", 1),
		Size:   qInt(c, "size", 24),
	}
	res, err := h.Title.List(c.Request().Context(), f)
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.Page(c, res.List, res.Total, f.Page, f.Size)
}

func (h *Handler) GetTitle(c echo.Context) error {
	ctx := c.Request().Context()
	id := paramInt64(c, "id")
	if id == 0 { // 非数字 → 当作拼音 slug 查
		id = h.Repo.TitleIDBySlug(ctx, c.Param("id"))
	}
	if id == 0 {
		return response.NotFound(c, "影片不存在")
	}
	dto, err := h.Title.Detail(ctx, id)
	if err != nil {
		return response.NotFound(c, "影片不存在")
	}
	// 登录用户附带个性化状态
	out := map[string]any{"detail": dto}
	if ie, os := h.Title.SkipMarker(ctx, id); ie > 0 || os > 0 {
		out["skip"] = map[string]int{"intro_end": ie, "outro_start": os}
	}
	if uid := middleware.UID(c); uid > 0 {
		out["is_favorite"] = h.User.IsFavorite(ctx, uid, id)
		out["is_subscribed"] = h.User.IsSubscribed(ctx, uid, id)
		out["is_liked"] = h.User.IsTitleLiked(ctx, uid, id)
		if p, err := h.User.GetProgress(ctx, uid, id); err == nil {
			out["progress"] = p
		}
	}
	return response.OK(c, out)
}

// RelatedTitles 相关推荐（看了还看）。
func (h *Handler) RelatedTitles(c echo.Context) error {
	list, err := h.Title.Related(c.Request().Context(), paramInt64(c, "id"), qInt(c, "limit", 12))
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, list)
}

// PersonTitles 某演员/导演的作品。
func (h *Handler) PersonTitles(c echo.Context) error {
	name := c.QueryParam("name")
	if name == "" {
		return response.BadRequest(c, "缺少 name")
	}
	page, size := qInt(c, "page", 1), qInt(c, "size", 30)
	res, err := h.Title.PersonTitles(c.Request().Context(), name, page, size)
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.Page(c, res.List, res.Total, page, size)
}

// 精选专题（编辑化合集 = 命名筛选预设，复用 Title.List）
var collections = []struct {
	Key, Title, Desc string
	Filter           repository.TitleFilter
}{
	{"douban-top", "豆瓣高分", "豆瓣口碑评分榜", repository.TitleFilter{Sort: "douban", DoubanOnly: true}},
	{"top-movie", "高分电影", "评分最高的电影佳作", repository.TitleFilter{Kind: model.KindMovie, Sort: "rating"}},
	{"hot-tv", "热门剧集", "最受追看的电视剧", repository.TitleFilter{Kind: model.KindTV, Sort: "popular"}},
	{"new-anime", "新番动漫", "最新更新的动漫", repository.TitleFilter{Kind: model.KindAnime, Sort: "latest"}},
	{"cn-good", "国产佳作", "华语高分内容", repository.TitleFilter{Region: "大陆", Sort: "rating"}},
	{"us-block", "欧美大片", "欧美高人气影视", repository.TitleFilter{Region: "欧美", Sort: "popular"}},
	{"top-variety", "高分综艺", "口碑综艺精选", repository.TitleFilter{Kind: model.KindVariety, Sort: "rating"}},
}

// Collections 精选专题列表（每个带预览片单）。
func (h *Handler) Collections(c echo.Context) error {
	ctx := c.Request().Context()
	type item struct {
		Key   string        `json:"key"`
		Title string        `json:"title"`
		Desc  string        `json:"desc"`
		List  []model.Title `json:"list"`
	}
	out := make([]item, 0, len(collections))
	for _, col := range collections {
		f := col.Filter
		f.Page, f.Size = 1, 12
		res, _ := h.Title.List(ctx, f)
		if res == nil || len(res.List) == 0 {
			continue
		}
		out = append(out, item{Key: col.Key, Title: col.Title, Desc: col.Desc, List: res.List})
	}
	return response.OK(c, out)
}

// CollectionTitles 某专题分页列表。
func (h *Handler) CollectionTitles(c echo.Context) error {
	key := c.Param("key")
	for _, col := range collections {
		if col.Key == key {
			f := col.Filter
			f.Page, f.Size = qInt(c, "page", 1), qInt(c, "size", 30)
			res, err := h.Title.List(c.Request().Context(), f)
			if err != nil {
				return response.Error(c, err.Error())
			}
			return response.OK(c, map[string]any{
				"title": col.Title, "desc": col.Desc,
				"list": res.List, "total": res.Total, "page": f.Page, "size": f.Size,
			})
		}
	}
	return response.NotFound(c, "专题不存在")
}

// SubmitSkip 用户提交片头片尾打点。
func (h *Handler) SubmitSkip(c echo.Context) error {
	var in struct {
		IntroEnd   int `json:"intro_end"`
		OutroStart int `json:"outro_start"`
	}
	if err := c.Bind(&in); err != nil {
		return response.BadRequest(c, "参数错误")
	}
	if err := h.Title.SubmitSkip(c.Request().Context(), paramInt64(c, "id"), middleware.UID(c), in.IntroEnd, in.OutroStart); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, map[string]any{"ok": true})
}

func (h *Handler) Search(c echo.Context) error {
	q := c.QueryParam("q")
	if q == "" {
		return response.BadRequest(c, "缺少搜索关键词")
	}
	page, size := qInt(c, "page", 1), qInt(c, "size", 24)
	if page == 1 {
		go h.Repo.LogSearch(context.Background(), q) // 热搜计数（仅首页，不阻塞响应）
	}
	// AI 语义搜索（mode=semantic）：向量召回，未配置则内部降级关键词
	if c.QueryParam("mode") == "semantic" {
		res, err := h.Title.SemanticSearch(c.Request().Context(), q, int16(qInt(c, "kind", 0)), size)
		if err != nil {
			return response.Error(c, err.Error())
		}
		return response.Page(c, res.List, res.Total, page, size)
	}
	res, err := h.Title.Search(c.Request().Context(), q, int16(qInt(c, "kind", 0)), c.QueryParam("sort"), page, size)
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.Page(c, res.List, res.Total, page, size)
}

// HotSearches 热搜榜。
func (h *Handler) HotSearches(c echo.Context) error {
	return response.OK(c, h.Repo.HotSearches(c.Request().Context(), qInt(c, "limit", 10)))
}

// Tags 该类型下常见标签（来自 vod_class）。
func (h *Handler) Tags(c echo.Context) error {
	return response.OK(c, h.Repo.TagsByKind(c.Request().Context(), int16(qInt(c, "kind", 0))))
}

// RandomTitle 随机一部（今天看点啥）。
func (h *Handler) RandomTitle(c echo.Context) error {
	t, err := h.Title.GetRandom(c.Request().Context(), int16(qInt(c, "kind", 0)), int64(qInt(c, "genre", 0)))
	if err != nil || t == nil {
		return response.NotFound(c, "没有可推荐的影片")
	}
	return response.OK(c, t)
}

// Recommend 为你推荐（需登录）：基于观看历史/收藏的个性化片单。
func (h *Handler) Recommend(c echo.Context) error {
	list, err := h.Title.Recommend(c.Request().Context(), middleware.UID(c), qInt(c, "limit", 12))
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, list)
}

func (h *Handler) Genres(c echo.Context) error {
	kind := int16(qInt(c, "kind", 0))
	gs, _ := h.Repo.GenresByKind(c.Request().Context(), kind)
	return response.OK(c, gs)
}

// Home 首页聚合：banner + 按类型榜单（各榜单在 Title.List 层已带缓存）。
func (h *Handler) Home(c echo.Context) error {
	ctx := c.Request().Context()
	type section struct {
		Title string        `json:"title"`
		Kind  int16         `json:"kind"`
		List  []model.Title `json:"list"`
	}
	defs := []struct {
		title string
		kind  int16
	}{
		{"热门电影", model.KindMovie},
		{"热门剧集", model.KindTV},
		{"综艺", model.KindVariety},
		{"动漫", model.KindAnime},
	}
	var secs []section
	for _, d := range defs {
		res, _ := h.Title.List(ctx, repository.TitleFilter{Kind: d.kind, Sort: "popular", Page: 1, Size: 12})
		if res != nil && len(res.List) > 0 {
			secs = append(secs, section{Title: d.title, Kind: d.kind, List: res.List})
		}
	}
	// banner：热门里挑有横图的，最多 6 条（横图多来自 TMDB 匹配的热门片）
	banner, _ := h.Title.List(ctx, repository.TitleFilter{Sort: "popular", Page: 1, Size: 60})
	var banners []model.Title
	if banner != nil {
		for _, t := range banner.List {
			if t.Backdrop != "" {
				banners = append(banners, t)
				if len(banners) >= 6 {
					break
				}
			}
		}
	}
	return response.OK(c, map[string]any{"banners": banners, "sections": secs})
}
