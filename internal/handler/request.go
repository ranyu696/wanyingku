package handler

import (
	"github.com/labstack/echo/v4"
	"github.com/xiaoxin/cms/internal/middleware"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/pkg/response"
)

// requestItem = 求片 + 当前用户是否已投票
type requestItem struct {
	model.Request
	IsVoted bool `json:"is_voted"`
}

func (h *Handler) CreateRequest(c echo.Context) error {
	var in struct {
		Name string `json:"name"`
		Year int    `json:"year"`
		Kind int16  `json:"kind"`
		Note string `json:"note"`
	}
	if err := c.Bind(&in); err != nil {
		return response.BadRequest(c, "参数错误")
	}
	uid := middleware.UID(c)
	var uidPtr *int64
	if uid > 0 {
		uidPtr = &uid
	}
	r, err := h.Req.Create(c.Request().Context(), uidPtr, in.Name, in.Year, in.Kind, in.Note)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}
	return response.OK(c, r)
}

// ListRequests 公开求片单（登录则带 is_voted）。status 缺省为全部。
func (h *Handler) ListRequests(c echo.Context) error {
	status := qInt(c, "status", -1)
	page, size := qInt(c, "page", 1), qInt(c, "size", 24)
	ctx := c.Request().Context()
	list, total, err := h.Req.List(ctx, status, page, size)
	if err != nil {
		return response.Error(c, err.Error())
	}
	ids := make([]int64, len(list))
	for i := range list {
		ids[i] = list[i].ID
	}
	voted := h.Req.VotedSet(ctx, middleware.UID(c), ids)
	items := make([]requestItem, len(list))
	for i := range list {
		items[i] = requestItem{Request: list[i], IsVoted: voted[list[i].ID]}
	}
	return response.Page(c, items, total, page, size)
}

// VoteRequest 顶片（+1，去重）。
func (h *Handler) VoteRequest(c echo.Context) error {
	count, voted, err := h.Req.Vote(c.Request().Context(), paramInt64(c, "id"), middleware.UID(c), true)
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, map[string]any{"vote_count": count, "is_voted": voted})
}

// UnvoteRequest 取消顶片。
func (h *Handler) UnvoteRequest(c echo.Context) error {
	count, voted, err := h.Req.Vote(c.Request().Context(), paramInt64(c, "id"), middleware.UID(c), false)
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, map[string]any{"vote_count": count, "is_voted": voted})
}

func (h *Handler) MyRequests(c echo.Context) error {
	uid := middleware.UID(c)
	page, size := qInt(c, "page", 1), qInt(c, "size", 24)
	list, total, err := h.Req.MyList(c.Request().Context(), uid, page, size)
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.Page(c, list, total, page, size)
}
