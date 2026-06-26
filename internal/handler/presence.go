package handler

import (
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/redis/go-redis/v9"
	"github.com/xiaoxin/cms/pkg/response"
)

// 在看人数：每个作品一个 Redis ZSET（member=客户端id, score=最后心跳秒）。
// 观看页每 30s 发一次心跳；窗口内（45s）有心跳的客户端计为「正在观看」。
// 只有真的在看的人发心跳，首页/片单广场只读不写 → 数字真实。
const watchWindow = 45 // 秒

func watchKey(id int64) string { return fmt.Sprintf("watch:%d", id) }

// Heartbeat POST /titles/:id/heartbeat?cid=xxx —— 上报心跳并返回当前在看人数。
func (h *Handler) Heartbeat(c echo.Context) error {
	id := paramInt64(c, "id")
	if id <= 0 || h.Cache == nil {
		return response.OK(c, map[string]any{"watching": 0})
	}
	cid := c.QueryParam("cid")
	if cid == "" {
		cid = c.RealIP() // 兜底：无客户端 id 时按 IP 去重
	}
	ctx := c.Request().Context()
	rdb := h.Cache.Client()
	now := time.Now().Unix()
	key := watchKey(id)
	pipe := rdb.Pipeline()
	pipe.ZAdd(ctx, key, redis.Z{Score: float64(now), Member: cid})
	pipe.Expire(ctx, key, 2*time.Minute)
	pipe.ZRemRangeByScore(ctx, key, "0", strconv.FormatInt(now-watchWindow, 10)) // 清过期心跳
	card := pipe.ZCard(ctx, key)
	_, _ = pipe.Exec(ctx)
	return response.OK(c, map[string]any{"watching": card.Val()})
}

// Watching GET /watching?ids=1,2,3 —— 批量查在看人数（首页/片单广场用），只返回 >0 的。
func (h *Handler) Watching(c echo.Context) error {
	counts := map[string]int64{}
	raw := strings.TrimSpace(c.QueryParam("ids"))
	if raw == "" || h.Cache == nil {
		return response.OK(c, map[string]any{"counts": counts})
	}
	parts := strings.Split(raw, ",")
	if len(parts) > 200 {
		parts = parts[:200]
	}
	ctx := c.Request().Context()
	rdb := h.Cache.Client()
	min := strconv.FormatInt(time.Now().Unix()-watchWindow, 10)
	pipe := rdb.Pipeline()
	ids := make([]string, 0, len(parts))
	cmds := make([]*redis.IntCmd, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		ids = append(ids, p)
		cmds = append(cmds, pipe.ZCount(ctx, watchKey(parseID(p)), min, "+inf"))
	}
	_, _ = pipe.Exec(ctx)
	for i, cmd := range cmds {
		if n := cmd.Val(); n > 0 {
			counts[ids[i]] = n
		}
	}
	return response.OK(c, map[string]any{"counts": counts})
}

func parseID(s string) int64 {
	n, _ := strconv.ParseInt(s, 10, 64)
	return n
}
