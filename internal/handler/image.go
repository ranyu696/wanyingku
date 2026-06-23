package handler

import (
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

// ImageProxy 私有桶图片分发（后端代理）：服务端用私有凭据从桶取流，直接吐给浏览器。
// 全程走自有域名 api.wanyingku.com,不暴露对象存储域名。加长缓存(内容按 sha1 寻址,不可变)
// 摊薄服务出站流量(浏览器/CDN 命中缓存后不再回源)。
// 路由形如 GET /api/v1/img/images/<hash>.webp,通配段即对象 key。
func (h *Handler) ImageProxy(c echo.Context) error {
	if h.Store == nil || !h.Store.Enabled() {
		return c.NoContent(http.StatusNotFound)
	}
	key := strings.TrimPrefix(c.Param("*"), "/")
	if key == "" {
		return c.NoContent(http.StatusNotFound)
	}
	rc, ctype, err := h.Store.Get(c.Request().Context(), key)
	if err != nil {
		return c.NoContent(http.StatusNotFound)
	}
	defer rc.Close()
	c.Response().Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	return c.Stream(http.StatusOK, ctype, rc)
}
