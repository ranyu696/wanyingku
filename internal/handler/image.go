package handler

import (
	"bytes"
	"image"
	"io"
	"net/http"
	"strconv"
	"strings"

	webp "github.com/chai2010/webp" // 解码 + 编码 WebP（cgo / 内置 libwebp）
	"github.com/labstack/echo/v4"
	xdraw "golang.org/x/image/draw"
)

// 允许的缩放宽度（与前端 srcset 对齐）；其余宽度按原图返回，避免缓存碎片化/被滥用。
// 200/400/640 海报档；960/1280/1920 首屏 backdrop 大图档（原图常 3840px，移动端解码慢）。
var imgWidths = map[int]bool{200: true, 400: true, 640: true, 960: true, 1280: true, 1920: true}

// ImageProxy 私有桶图片分发（后端代理）：服务端用私有凭据从桶取流，直接吐给浏览器。
// 全程走自有域名 api.wanyingku.com,不暴露对象存储域名。加长缓存(内容按 sha1 寻址,不可变)
// 摊薄服务出站流量(浏览器/CDN 命中缓存后不再回源)。
// 路由形如 GET /api/v1/img/images/<hash>.webp,通配段即对象 key。
// 可选 ?w=<宽> 按宽等比缩放（仅允许的几档、不放大），变体同样不可变长缓存(URL 含 w，CDN 各档独立命中)。
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

	// 默认路径：不带 w（或 w 不在允许档）→ 原样流式转发，零额外开销。
	w, _ := strconv.Atoi(c.QueryParam("w"))
	if !imgWidths[w] {
		return c.Stream(http.StatusOK, ctype, rc)
	}

	// 缩放路径：读出原图（限 20MB 防异常大图），解码→等比缩→编码 WebP。
	data, err := io.ReadAll(io.LimitReader(rc, 20<<20))
	if err != nil {
		return c.NoContent(http.StatusBadGateway)
	}
	if out, ct, ok := resizeWebP(data, w); ok {
		return c.Blob(http.StatusOK, ct, out)
	}
	// 不能/无需缩放（解码失败或原图已不大于目标宽）→ 原图字节原样吐。
	return c.Blob(http.StatusOK, ctype, data)
}

// resizeWebP 解码原图，等比缩到目标宽（不放大），编码 WebP(quality 80)。任一步失败返回 ok=false。
func resizeWebP(data []byte, width int) (out []byte, ctype string, ok bool) {
	img, _, err := image.Decode(bytes.NewReader(data))
	if err != nil {
		return nil, "", false
	}
	b := img.Bounds()
	if b.Dx() <= width { // 不放大：原宽已不大于目标，保留原图（避免重编码反而变大）
		return nil, "", false
	}
	nh := b.Dy() * width / b.Dx()
	if nh < 1 {
		nh = 1
	}
	dst := image.NewRGBA(image.Rect(0, 0, width, nh))
	xdraw.CatmullRom.Scale(dst, dst.Bounds(), img, b, xdraw.Over, nil)
	var buf bytes.Buffer
	if err := webp.Encode(&buf, dst, &webp.Options{Quality: 80}); err != nil || buf.Len() == 0 {
		return nil, "", false
	}
	return buf.Bytes(), "image/webp", true
}
