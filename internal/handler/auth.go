package handler

import (
	"github.com/labstack/echo/v4"
	"github.com/xiaoxin/cms/internal/middleware"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/pkg/response"
)

type authReq struct {
	Username string `json:"username"`
	Password string `json:"password"`
	Nickname string `json:"nickname"`
}

func (h *Handler) Register(c echo.Context) error {
	var in authReq
	if err := c.Bind(&in); err != nil {
		return response.BadRequest(c, "参数错误")
	}
	res, err := h.Auth.Register(c.Request().Context(), in.Username, in.Password, in.Nickname)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}
	return response.OK(c, res)
}

func (h *Handler) Login(c echo.Context) error {
	var in authReq
	if err := c.Bind(&in); err != nil {
		return response.BadRequest(c, "参数错误")
	}
	res, err := h.Auth.Login(c.Request().Context(), in.Username, in.Password)
	if err != nil {
		return response.BadRequest(c, err.Error())
	}
	return response.OK(c, res)
}

func (h *Handler) Me(c echo.Context) error {
	uid := middleware.UID(c)
	var u model.User
	if err := h.DB.WithContext(c.Request().Context()).First(&u, uid).Error; err != nil {
		return response.NotFound(c, "用户不存在")
	}
	return response.OK(c, u)
}
