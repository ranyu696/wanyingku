package handler

import (
	"context"
	"log/slog"
	"strconv"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/pkg/response"
)

// AdminReindex 全量重建 Meili 搜索索引。后台异步跑：90k 量级同步会打爆请求超时、
// 请求一断 ctx 取消就半途而废。立即返回，重建在背景 context 下完整跑完。
func (h *Handler) AdminReindex(c echo.Context) error {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		n := h.Syncer.ReindexAll(ctx)
		slog.Info("reindex done", "indexed", n)
	}()
	return response.OK(c, map[string]any{"started": true})
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

// AutoReviewProposal 一条自动复核的合并方案。
type AutoReviewProposal struct {
	FromID   int64   `json:"from_id"`
	ToID     int64   `json:"to_id"`
	FromName string  `json:"from_name"`
	ToName   string  `json:"to_name"`
	Score    float32 `json:"score"`
}

type autoReviewResult struct {
	Scanned   int                  `json:"scanned"`
	Merged    int                  `json:"merged"`
	Cleared   int                  `json:"cleared"`
	DryRun    bool                 `json:"dry_run"`
	MinScore  float32              `json:"min_score"`
	Proposals []AutoReviewProposal `json:"proposals,omitempty"`
}

// AutoReview 批量自动复核 needs_review 队列，替代手工逐条审核：
// 每条复核作品用采集期同套模糊召回找库里最像的「另一条」，分数≥min_score 判为重复→合并
// (保留 source_count 高的为主，另一条并入)，否则判独立→清 needs_review。复用 fuzzyCandidates
// 自带的「续作/不同季不匹配」保护。
// dry=1(默认) 只产出方案不改库；limit>0 仅处理前 N 条(抽样)。dry=0 且 limit=0 时全量异步跑。
func (h *Handler) AutoReview(c echo.Context) error {
	dry := c.QueryParam("dry") != "0" // 默认 dry-run，必须显式 dry=0 才真改
	limit := qInt(c, "limit", 0)
	minScore := float32(0.8)
	if v := c.QueryParam("min_score"); v != "" {
		if f, err := strconv.ParseFloat(v, 32); err == nil {
			minScore = float32(f)
		}
	}
	// dry-run 或小批量：同步返回结果供核对
	if dry || (limit > 0 && limit <= 300) {
		return response.OK(c, h.runAutoReview(c.Request().Context(), minScore, dry, limit))
	}
	// 全量执行：异步跑，日志报结果（量大、会超请求时限）
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Hour)
		defer cancel()
		res := h.runAutoReview(ctx, minScore, false, limit)
		slog.Info("auto-review done", "scanned", res.Scanned, "merged", res.Merged, "cleared", res.Cleared)
	}()
	return response.OK(c, map[string]any{"started": true, "min_score": minScore})
}

func (h *Handler) runAutoReview(ctx context.Context, minScore float32, dry bool, limit int) *autoReviewResult {
	res := &autoReviewResult{DryRun: dry, MinScore: minScore}
	var ids []int64
	h.DB.WithContext(ctx).Model(&model.SourceItem{}).
		Where("needs_review = true AND title_id IS NOT NULL").
		Distinct().Pluck("title_id", &ids)
	if limit > 0 && len(ids) > limit {
		ids = ids[:limit]
	}
	for _, tid := range ids {
		select {
		case <-ctx.Done():
			return res
		default:
		}
		res.Scanned++
		var t model.Title
		if err := h.DB.WithContext(ctx).First(&t, tid).Error; err != nil {
			continue // 作品已不存在(可能本批已被并掉)，跳过
		}
		candID, score, ok := h.Syncer.FindDuplicate(ctx, &t)
		if !ok || score < minScore {
			if !dry { // 判为独立作品：清复核标记
				h.DB.WithContext(ctx).Model(&model.SourceItem{}).Where("title_id = ?", t.ID).Update("needs_review", false)
			}
			res.Cleared++
			continue
		}
		from, to, valid := h.mergeDirection(ctx, t.ID, candID)
		if !valid {
			continue // 候选已不存在，跳过
		}
		if dry {
			if len(res.Proposals) < 500 {
				var fn, tn string
				h.DB.WithContext(ctx).Model(&model.Title{}).Where("id = ?", from).Pluck("name", &fn)
				h.DB.WithContext(ctx).Model(&model.Title{}).Where("id = ?", to).Pluck("name", &tn)
				res.Proposals = append(res.Proposals, AutoReviewProposal{FromID: from, ToID: to, FromName: fn, ToName: tn, Score: score})
			}
			res.Merged++
			continue
		}
		if err := h.Repo.MergeTitles(ctx, from, to); err != nil {
			slog.Error("auto-review merge failed", "from", from, "to", to, "err", err)
			continue
		}
		// 存活的 to 也可能本身是复核项 → 一并清标记
		h.DB.WithContext(ctx).Model(&model.SourceItem{}).Where("title_id = ?", to).Update("needs_review", false)
		h.Title.InvalidateDetail(ctx, from)
		h.Title.InvalidateDetail(ctx, to)
		h.Syncer.RemoveFromIndex(ctx, from)
		res.Merged++
	}
	return res
}

// mergeDirection 决定合并方向：保留 source_count 高的(更完整)为 to，另一条并入；
// 持平则保留 id 小的(更早/更规范)。两条任一不存在则 valid=false。
func (h *Handler) mergeDirection(ctx context.Context, a, b int64) (from, to int64, valid bool) {
	type row struct {
		ID          int64
		SourceCount int
	}
	var rows []row
	h.DB.WithContext(ctx).Model(&model.Title{}).Select("id, source_count").Where("id IN ?", []int64{a, b}).Scan(&rows)
	if len(rows) < 2 {
		return 0, 0, false
	}
	sc := map[int64]int{}
	for _, r := range rows {
		sc[r.ID] = r.SourceCount
	}
	if sc[b] > sc[a] || (sc[b] == sc[a] && b < a) {
		return a, b, true // 保留 b
	}
	return b, a, true // 保留 a
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
