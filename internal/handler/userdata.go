package handler

import (
	"github.com/labstack/echo/v4"
	"github.com/xiaoxin/cms/internal/middleware"
	"github.com/xiaoxin/cms/internal/service/userdata"
	"github.com/xiaoxin/cms/pkg/response"
)

// ---- 收藏 ----

func (h *Handler) ListFavorites(c echo.Context) error {
	uid := middleware.UID(c)
	page, size := qInt(c, "page", 1), qInt(c, "size", 24)
	list, total, err := h.User.ListFavorites(c.Request().Context(), uid, page, size)
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.Page(c, list, total, page, size)
}

func (h *Handler) AddFavorite(c echo.Context) error {
	var in struct {
		TitleID int64 `json:"title_id"`
	}
	if err := c.Bind(&in); err != nil || in.TitleID == 0 {
		return response.BadRequest(c, "参数错误")
	}
	if err := h.User.AddFavorite(c.Request().Context(), middleware.UID(c), in.TitleID); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

func (h *Handler) RemoveFavorite(c echo.Context) error {
	if err := h.User.RemoveFavorite(c.Request().Context(), middleware.UID(c), paramInt64(c, "id")); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

// ---- 观看历史/进度 ----

func (h *Handler) ListHistory(c echo.Context) error {
	uid := middleware.UID(c)
	page, size := qInt(c, "page", 1), qInt(c, "size", 24)
	list, total, err := h.User.ListHistory(c.Request().Context(), uid, page, size)
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.Page(c, list, total, page, size)
}

func (h *Handler) SaveProgress(c echo.Context) error {
	var in userdata.ProgressInput
	if err := c.Bind(&in); err != nil || in.TitleID == 0 {
		return response.BadRequest(c, "参数错误")
	}
	if err := h.User.SaveProgress(c.Request().Context(), middleware.UID(c), in); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

func (h *Handler) DeleteHistory(c echo.Context) error {
	if err := h.User.DeleteHistory(c.Request().Context(), middleware.UID(c), paramInt64(c, "id")); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

// ---- 订阅更新 ----

func (h *Handler) ListSubscriptions(c echo.Context) error {
	uid := middleware.UID(c)
	page, size := qInt(c, "page", 1), qInt(c, "size", 24)
	list, total, err := h.User.ListSubscriptions(c.Request().Context(), uid, page, size)
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.Page(c, list, total, page, size)
}

func (h *Handler) Subscribe(c echo.Context) error {
	var in struct {
		TitleID int64 `json:"title_id"`
	}
	if err := c.Bind(&in); err != nil || in.TitleID == 0 {
		return response.BadRequest(c, "参数错误")
	}
	if err := h.User.Subscribe(c.Request().Context(), middleware.UID(c), in.TitleID); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

func (h *Handler) Unsubscribe(c echo.Context) error {
	if err := h.User.Unsubscribe(c.Request().Context(), middleware.UID(c), paramInt64(c, "id")); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

// ---- 通知 ----

func (h *Handler) ListNotifications(c echo.Context) error {
	uid := middleware.UID(c)
	page, size := qInt(c, "page", 1), qInt(c, "size", 24)
	list, total, err := h.User.ListNotifications(c.Request().Context(), uid, page, size)
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.Page(c, list, total, page, size)
}

func (h *Handler) UnreadCount(c echo.Context) error {
	return response.OK(c, map[string]any{"unread": h.User.UnreadCount(c.Request().Context(), middleware.UID(c))})
}

func (h *Handler) MarkRead(c echo.Context) error {
	if err := h.User.MarkRead(c.Request().Context(), middleware.UID(c), paramInt64(c, "id")); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

func (h *Handler) MarkAllRead(c echo.Context) error {
	if err := h.User.MarkAllRead(c.Request().Context(), middleware.UID(c)); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}
