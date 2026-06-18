package handler

import (
	"context"
	"log/slog"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/pkg/response"
)

// AdminReindex 全量重建 Meili 搜索索引。
func (h *Handler) AdminReindex(c echo.Context) error {
	n := h.Syncer.ReindexAll(c.Request().Context())
	return response.OK(c, map[string]any{"indexed": n})
}

// SourceHealthStats 采集源健康监控：每源线路健康分布 + 平均延迟 + 最近同步/探活。
func (h *Handler) SourceHealthStats(c echo.Context) error {
	type row struct {
		ID          int        `json:"id"`
		Name        string     `json:"name"`
		Enabled     bool       `json:"enabled"`
		Weight      int        `json:"weight"`
		LastSyncAt  *time.Time `json:"last_sync_at"`
		Lines       int        `json:"lines"`
		Alive       int        `json:"alive"`
		Dead        int        `json:"dead"`
		Unknown     int        `json:"unknown"`
		AvgLatency  *int       `json:"avg_latency"`
		LastChecked *time.Time `json:"last_checked"`
		Titles      int        `json:"titles"`
	}
	var rows []row
	h.DB.WithContext(c.Request().Context()).Raw(`
		SELECT s.id, s.name, s.enabled, s.weight, s.last_sync_at,
			count(ps.id) AS lines,
			count(*) FILTER (WHERE ps.health = 1)  AS alive,
			count(*) FILTER (WHERE ps.health = -1) AS dead,
			count(*) FILTER (WHERE ps.health = 0)  AS unknown,
			round(avg(ps.latency_ms) FILTER (WHERE ps.health = 1))::int AS avg_latency,
			max(ps.last_checked_at) AS last_checked,
			count(DISTINCT ps.title_id) AS titles
		FROM sources s LEFT JOIN play_sources ps ON ps.source_id = s.id
		GROUP BY s.id ORDER BY s.weight DESC, s.id`).Scan(&rows)
	return response.OK(c, rows)
}

// ---- 采集源管理 ----

func (h *Handler) ListSources(c echo.Context) error {
	var list []model.Source
	h.DB.WithContext(c.Request().Context()).Order("weight DESC, id ASC").Find(&list)
	return response.OK(c, list)
}

type sourceReq struct {
	Name            string `json:"name"`
	APIURL          string `json:"api_url"`
	APIType         int16  `json:"api_type"`
	Enabled         *bool  `json:"enabled"`
	Weight          int    `json:"weight"`
	SyncIntervalMin int    `json:"sync_interval_min"`
	Note            string `json:"note"`
}

func (h *Handler) CreateSource(c echo.Context) error {
	var in sourceReq
	if err := c.Bind(&in); err != nil || in.APIURL == "" || in.Name == "" {
		return response.BadRequest(c, "名称和接口地址必填")
	}
	s := model.Source{
		Name: in.Name, APIURL: in.APIURL, APIType: orDefault16(in.APIType, 1),
		Enabled: in.Enabled == nil || *in.Enabled, Weight: in.Weight,
		SyncIntervalMin: orDefault(in.SyncIntervalMin, 720), Note: in.Note,
	}
	if err := h.DB.WithContext(c.Request().Context()).Create(&s).Error; err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, s)
}

func (h *Handler) UpdateSource(c echo.Context) error {
	id := paramInt64(c, "id")
	var in sourceReq
	if err := c.Bind(&in); err != nil {
		return response.BadRequest(c, "参数错误")
	}
	updates := map[string]any{
		"name": in.Name, "api_url": in.APIURL, "api_type": in.APIType,
		"weight": in.Weight, "sync_interval_min": in.SyncIntervalMin, "note": in.Note,
		"updated_at": time.Now(),
	}
	if in.Enabled != nil {
		updates["enabled"] = *in.Enabled
	}
	if err := h.DB.WithContext(c.Request().Context()).Model(&model.Source{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

func (h *Handler) DeleteSource(c echo.Context) error {
	if err := h.DB.WithContext(c.Request().Context()).Delete(&model.Source{}, paramInt64(c, "id")).Error; err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

// SyncSource 异步触发单源采集。
func (h *Handler) SyncSource(c echo.Context) error {
	id := paramInt64(c, "id")
	full := c.QueryParam("full") == "1"
	var src model.Source
	if err := h.DB.WithContext(c.Request().Context()).First(&src, id).Error; err != nil {
		return response.NotFound(c, "采集源不存在")
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		if _, err := h.Syncer.SyncSource(ctx, &src, full); err != nil {
			slog.Error("manual sync failed", "source", src.Name, "err", err)
		}
	}()
	return response.OK(c, map[string]any{"started": true, "source": src.Name, "full": full})
}

// SyncAll 异步触发全部启用源采集。
func (h *Handler) SyncAll(c echo.Context) error {
	full := c.QueryParam("full") == "1"
	var srcs []model.Source
	h.DB.WithContext(c.Request().Context()).Where("enabled = true").Find(&srcs)
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Hour)
		defer cancel()
		for i := range srcs {
			if _, err := h.Syncer.SyncSource(ctx, &srcs[i], full); err != nil {
				slog.Error("sync-all item failed", "source", srcs[i].Name, "err", err)
			}
		}
	}()
	return response.OK(c, map[string]any{"started": true, "count": len(srcs), "full": full})
}

// ---- 去重复核与人工合并 ----

// ReviewList 列出待人工复核的采集记录（灰区匹配）。
func (h *Handler) ReviewList(c echo.Context) error {
	page, size := qInt(c, "page", 1), qInt(c, "size", 24)
	q := h.DB.WithContext(c.Request().Context()).Model(&model.SourceItem{}).Where("needs_review = true")
	var total int64
	q.Count(&total)
	var list []model.SourceItem
	q.Order("updated_at DESC").Offset((page - 1) * size).Limit(size).Find(&list)
	return response.Page(c, list, total, page, size)
}

// MergeTitles 把 from 作品并入 to（解决误判为两条的情况）。
func (h *Handler) MergeTitles(c echo.Context) error {
	var in struct {
		FromID int64 `json:"from_id"`
		ToID   int64 `json:"to_id"`
	}
	if err := c.Bind(&in); err != nil || in.FromID == 0 || in.ToID == 0 || in.FromID == in.ToID {
		return response.BadRequest(c, "参数错误")
	}
	ctx := c.Request().Context()
	if err := h.Repo.MergeTitles(ctx, in.FromID, in.ToID); err != nil {
		return response.Error(c, err.Error())
	}
	h.Title.InvalidateDetail(ctx, in.FromID)
	h.Title.InvalidateDetail(ctx, in.ToID)
	h.Syncer.RemoveFromIndex(ctx, in.FromID) // from 已被并掉，删其搜索索引文档
	return response.OK(c, nil)
}

// ---- 求片处理 ----

func (h *Handler) ListAdminRequests(c echo.Context) error {
	status := qInt(c, "status", -1)
	page, size := qInt(c, "page", 1), qInt(c, "size", 24)
	list, total, err := h.Req.List(c.Request().Context(), status, page, size)
	if err != nil {
		return response.Error(c, err.Error())
	}
	return response.Page(c, list, total, page, size)
}

func (h *Handler) UpdateRequest(c echo.Context) error {
	id := paramInt64(c, "id")
	var in struct {
		Status    int16  `json:"status"`
		TitleID   *int64 `json:"title_id"`
		AdminNote string `json:"admin_note"`
	}
	if err := c.Bind(&in); err != nil {
		return response.BadRequest(c, "参数错误")
	}
	if err := h.Req.UpdateStatus(c.Request().Context(), id, in.Status, in.TitleID, in.AdminNote); err != nil {
		return response.Error(c, err.Error())
	}
	return response.OK(c, nil)
}

// ---- 统计 ----

func (h *Handler) Stats(c echo.Context) error {
	ctx := c.Request().Context()
	db := h.DB.WithContext(ctx)
	var titles, sources, items, review, reqPending int64
	db.Model(&model.Title{}).Count(&titles)
	db.Model(&model.Source{}).Count(&sources)
	db.Model(&model.SourceItem{}).Count(&items)
	db.Model(&model.SourceItem{}).Where("needs_review = true").Count(&review)
	db.Model(&model.Request{}).Where("status = 0").Count(&reqPending)

	type kindCount struct {
		Kind  int16 `json:"kind"`
		Count int64 `json:"count"`
	}
	var byKind []kindCount
	db.Model(&model.Title{}).Select("kind, count(*) as count").Group("kind").Scan(&byKind)

	return response.OK(c, map[string]any{
		"titles": titles, "sources": sources, "source_items": items,
		"needs_review": review, "requests_pending": reqPending, "by_kind": byKind,
	})
}

func orDefault(v, def int) int {
	if v == 0 {
		return def
	}
	return v
}

func orDefault16(v, def int16) int16 {
	if v == 0 {
		return def
	}
	return v
}
