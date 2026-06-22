package handler

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

// ImageProxy 私有桶图片分发：为对象 key 生成预签名 URL 并 302 重定向。
// 图片字节由对象存储直发浏览器（桶出站免费），后端只发跳转头，不转发图片内容。
// 路由形如 GET /api/v1/img/images/<hash>.jpg，通配段即对象 key。
func (h *Handler) ImageProxy(c echo.Context) error {
	if h.Store == nil || !h.Store.Enabled() {
		return c.NoContent(http.StatusNotFound)
	}
	key := strings.TrimPrefix(c.Param("*"), "/")
	if key == "" {
		return c.NoContent(http.StatusNotFound)
	}
	url, err := h.Store.PresignGet(c.Request().Context(), key)
	if err != nil {
		return c.NoContent(http.StatusBadGateway)
	}
	// 浏览器/CDN 可短时缓存该跳转；缓存时长须小于预签名有效期（24h）。
	c.Response().Header().Set("Cache-Control", "public, max-age=3600")
	return c.Redirect(http.StatusFound, url)
}
