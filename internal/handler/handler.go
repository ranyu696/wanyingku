// Package handler 是 HTTP 层。
package handler

import (
	"strconv"

	"github.com/labstack/echo/v4"
	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/repository"
	"github.com/xiaoxin/cms/internal/service/auth"
	"github.com/xiaoxin/cms/internal/service/collect"
	"github.com/xiaoxin/cms/internal/service/push"
	"github.com/xiaoxin/cms/internal/service/request"
	"github.com/xiaoxin/cms/internal/service/title"
	"github.com/xiaoxin/cms/internal/service/userdata"
	"gorm.io/gorm"
)

type Handler struct {
	Cfg    *config.Config
	Title  *title.Service
	Auth   *auth.Service
	User   *userdata.Service
	Req    *request.Service
	Repo   *repository.Repo
	Syncer *collect.Syncer
	Push   *push.Service
	DB     *gorm.DB
}

func qInt(c echo.Context, name string, def int) int {
	if v := c.QueryParam(name); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return def
}

func paramInt64(c echo.Context, name string) int64 {
	n, _ := strconv.ParseInt(c.Param(name), 10, 64)
	return n
}
