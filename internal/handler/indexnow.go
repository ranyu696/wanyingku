package handler

import (
	"os"

	"github.com/labstack/echo/v4"
	"github.com/xiaoxin/cms/internal/service/collect"
	"github.com/xiaoxin/cms/pkg/response"
)

// AdminIndexNow 手动触发 IndexNow 提交（近 ?days 天，默认 2）。常态化由 scheduler 每日自动跑。
// 需环境变量 YINSHI_INDEXNOW_KEY + YINSHI_SITE_URL；密钥文件由前端托管在 <site>/<key>.txt。
func (h *Handler) AdminIndexNow(c echo.Context) error {
	key := os.Getenv("YINSHI_INDEXNOW_KEY")
	site := os.Getenv("YINSHI_SITE_URL")
	if key == "" || site == "" {
		return response.BadRequest(c, "未配置 YINSHI_INDEXNOW_KEY / YINSHI_SITE_URL")
	}
	n, status, err := collect.SubmitIndexNow(c.Request().Context(), h.DB, site, key, qInt(c, "days", 2))
	if err != nil {
		return response.Error(c, "提交失败: "+err.Error())
	}
	return response.OK(c, map[string]any{"submitted": n, "indexnow_status": status})
}
