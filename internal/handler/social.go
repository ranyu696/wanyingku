package handler

import (
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/xiaoxin/cms/internal/middleware"
	"github.com/xiaoxin/cms/pkg/response"
)

// ListComments 作品评论（公开，登录则带 is_liked）。
func (h *Handler) ListComments(c echo.Context) error {
	id := paramInt64(c, "id")
	page, size := qInt(c, "page", 1), qInt(c, "size", 20)
	list, total, err := h.User.ListComments(c.Request().Context(), id, middleware.UID(c), page, size)
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.Page(c, list, total, page, size)
}

func (h *Handler) AddComment(c echo.Context) error {
	var in struct {
		TitleID int64  `json:"title_id"`
		Content string `json:"content"`
	}
	if err := c.Bind(&in); err != nil || in.TitleID == 0 || strings.TrimSpace(in.Content) == "" {
		return response.BadRequest(c, "请填写评论内容")
	}
	cm, err := h.User.AddComment(c.Request().Context(), middleware.UID(c), in.TitleID, strings.TrimSpace(in.Content))
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, cm)
}

func (h *Handler) DeleteComment(c echo.Context) error {
	if err := h.User.DeleteComment(c.Request().Context(), middleware.UID(c), paramInt64(c, "id")); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

func (h *Handler) LikeComment(c echo.Context) error {
	if err := h.User.LikeComment(c.Request().Context(), middleware.UID(c), paramInt64(c, "id"), true); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

func (h *Handler) UnlikeComment(c echo.Context) error {
	if err := h.User.LikeComment(c.Request().Context(), middleware.UID(c), paramInt64(c, "id"), false); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

func (h *Handler) LikeTitle(c echo.Context) error {
	if err := h.User.LikeTitle(c.Request().Context(), middleware.UID(c), paramInt64(c, "id"), true); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

func (h *Handler) UnlikeTitle(c echo.Context) error {
	if err := h.User.LikeTitle(c.Request().Context(), middleware.UID(c), paramInt64(c, "id"), false); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

// RegisterPushToken 注册/更新本设备 FCM 令牌（需登录）。
func (h *Handler) RegisterPushToken(c echo.Context) error {
	var in struct {
		Token    string `json:"token"`
		Platform string `json:"platform"`
	}
	if err := c.Bind(&in); err != nil || strings.TrimSpace(in.Token) == "" {
		return response.BadRequest(c, "缺少 token")
	}
	if err := h.Push.SaveToken(c.Request().Context(), middleware.UID(c), strings.TrimSpace(in.Token), in.Platform); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, map[string]any{"ok": true})
}

// UnregisterPushToken 注销令牌（登出/卸载）。
func (h *Handler) UnregisterPushToken(c echo.Context) error {
	var in struct {
		Token string `json:"token"`
	}
	if err := c.Bind(&in); err != nil || strings.TrimSpace(in.Token) == "" {
		return response.BadRequest(c, "缺少 token")
	}
	if err := h.Push.DeleteToken(c.Request().Context(), strings.TrimSpace(in.Token)); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, map[string]any{"ok": true})
}
