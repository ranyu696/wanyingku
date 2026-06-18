package handler

import (
	"github.com/labstack/echo/v4"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/pkg/response"
)

// ---- 作品管理 ----

// AdminListTitles 作品列表（含隐藏），支持搜索/类型/状态/归类方式筛选。
func (h *Handler) AdminListTitles(c echo.Context) error {
	ctx := c.Request().Context()
	q := c.QueryParam("q")
	kind := qInt(c, "kind", 0)
	status := qInt(c, "status", -1)
	matchStatus := qInt(c, "match_status", -1)
	page := qInt(c, "page", 1)
	size := qInt(c, "size", 20)
	if size < 1 || size > 100 {
		size = 20
	}

	tx := h.DB.WithContext(ctx).Model(&model.Title{})
	if q != "" {
		like := "%" + q + "%"
		tx = tx.Where("name ILIKE ? OR original_name ILIKE ? OR norm_title ILIKE ?", like, like, like)
	}
	if kind > 0 {
		tx = tx.Where("kind = ?", kind)
	}
	if status >= 0 {
		tx = tx.Where("status = ?", status)
	}
	if matchStatus >= 0 {
		tx = tx.Where("match_status = ?", matchStatus)
	}
	var total int64
	tx.Count(&total)
	var list []model.Title
	tx.Order("updated_at DESC").Offset((page - 1) * size).Limit(size).Find(&list)
	return response.Page(c, list, total, page, size)
}

// AdminGetTitle 作品详情（含播放源/剧集/别名，不限状态）。
func (h *Handler) AdminGetTitle(c echo.Context) error {
	ctx := c.Request().Context()
	id := paramInt64(c, "id")
	var t model.Title
	if err := h.DB.WithContext(ctx).First(&t, id).Error; err != nil {
		return response.NotFound(c, "作品不存在")
	}
	ps, _ := h.Repo.PlaySources(ctx, id)
	aliases, _ := h.Repo.Aliases(ctx, id)
	genres, _ := h.Repo.Genres(ctx, []int64(t.GenreIDs))
	return response.OK(c, map[string]any{
		"title": t, "play_sources": ps, "aliases": aliases, "genres": genres,
	})
}

// AdminUpdateTitle 编辑作品字段（部分更新）。
func (h *Handler) AdminUpdateTitle(c echo.Context) error {
	ctx := c.Request().Context()
	id := paramInt64(c, "id")
	var in struct {
		Name         *string `json:"name"`
		OriginalName *string `json:"original_name"`
		Overview     *string `json:"overview"`
		Poster       *string `json:"poster"`
		Backdrop     *string `json:"backdrop"`
		Year         *int    `json:"year"`
		Kind         *int16  `json:"kind"`
		Status       *int16  `json:"status"`
	}
	if err := c.Bind(&in); err != nil {
		return response.BadRequest(c, "参数错误")
	}
	updates := map[string]any{}
	if in.Name != nil {
		updates["name"] = *in.Name
	}
	if in.OriginalName != nil {
		updates["original_name"] = *in.OriginalName
	}
	if in.Overview != nil {
		updates["overview"] = *in.Overview
	}
	if in.Poster != nil {
		updates["poster"] = *in.Poster
	}
	if in.Backdrop != nil {
		updates["backdrop"] = *in.Backdrop
	}
	if in.Year != nil {
		updates["year"] = *in.Year
	}
	if in.Kind != nil {
		updates["kind"] = *in.Kind
	}
	if in.Status != nil {
		updates["status"] = *in.Status
	}
	if len(updates) == 0 {
		return response.OK(c, nil)
	}
	if err := h.DB.WithContext(ctx).Model(&model.Title{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return response.Error(c, err.Error())
	}
	h.Title.InvalidateDetail(ctx, id)
	return response.OK(c, nil)
}

// AdminDeleteTitle 删除作品（级联播放源/剧集/别名）。
func (h *Handler) AdminDeleteTitle(c echo.Context) error {
	ctx := c.Request().Context()
	id := paramInt64(c, "id")
	if err := h.DB.WithContext(ctx).Delete(&model.Title{}, id).Error; err != nil {
		return response.Error(c, err.Error())
	}
	h.Title.InvalidateDetail(ctx, id)
	h.Syncer.RemoveFromIndex(ctx, id) // 同步删除搜索索引文档
	return response.OK(c, nil)
}

// ---- 采集记录 ----

// AdminListSourceItems 浏览原始采集记录。
func (h *Handler) AdminListSourceItems(c echo.Context) error {
	ctx := c.Request().Context()
	q := c.QueryParam("q")
	sourceID := qInt(c, "source_id", 0)
	page := qInt(c, "page", 1)
	size := qInt(c, "size", 30)
	if size < 1 || size > 100 {
		size = 30
	}
	tx := h.DB.WithContext(ctx).Model(&model.SourceItem{})
	if q != "" {
		tx = tx.Where("name ILIKE ?", "%"+q+"%")
	}
	if sourceID > 0 {
		tx = tx.Where("source_id = ?", sourceID)
	}
	if c.QueryParam("needs_review") == "1" {
		tx = tx.Where("needs_review = true")
	}
	var total int64
	tx.Count(&total)
	var list []model.SourceItem
	tx.Order("updated_at DESC").Offset((page - 1) * size).Limit(size).Find(&list)
	return response.Page(c, list, total, page, size)
}

// ---- 用户管理 ----

func (h *Handler) AdminListUsers(c echo.Context) error {
	ctx := c.Request().Context()
	page := qInt(c, "page", 1)
	size := qInt(c, "size", 30)
	if size < 1 || size > 100 {
		size = 30
	}
	tx := h.DB.WithContext(ctx).Model(&model.User{})
	if q := c.QueryParam("q"); q != "" {
		tx = tx.Where("username ILIKE ? OR nickname ILIKE ?", "%"+q+"%", "%"+q+"%")
	}
	var total int64
	tx.Count(&total)
	var list []model.User
	tx.Order("id").Offset((page - 1) * size).Limit(size).Find(&list)
	return response.Page(c, list, total, page, size)
}

func (h *Handler) AdminUpdateUser(c echo.Context) error {
	ctx := c.Request().Context()
	id := paramInt64(c, "id")
	var in struct {
		Role   *int16 `json:"role"`
		Status *int16 `json:"status"`
	}
	if err := c.Bind(&in); err != nil {
		return response.BadRequest(c, "参数错误")
	}
	updates := map[string]any{}
	if in.Role != nil {
		updates["role"] = *in.Role
	}
	if in.Status != nil {
		updates["status"] = *in.Status
	}
	if len(updates) == 0 {
		return response.OK(c, nil)
	}
	if err := h.DB.WithContext(ctx).Model(&model.User{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}
