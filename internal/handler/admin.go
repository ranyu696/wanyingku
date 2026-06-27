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

// ResetContent 一次性重建：清空所有内容表 + CASCADE 连带清掉绑定作品的用户活动(收藏/历史/评论/订阅/
// 点赞/求片/片头尾)，ID 全部重置为 1。保留账号(users)/配置(sources/genres/categories)/设备/通知。
// 不可逆！需 confirm=YES-WIPE-ALL。
func (h *Handler) ResetContent(c echo.Context) error {
	if c.QueryParam("confirm") != "YES-WIPE-ALL" {
		return response.BadRequest(c, "需 confirm=YES-WIPE-ALL（不可逆，会清空全部作品与绑定作品的用户活动）")
	}
	ctx := c.Request().Context()
	if err := h.DB.WithContext(ctx).Exec(
		`TRUNCATE titles, title_aliases, source_items, play_sources, episodes RESTART IDENTITY CASCADE`).Error; err != nil {
		return response.Error(c, err.Error())
	}
	go func() {
		bg, cancel := context.WithTimeout(context.Background(), 15*time.Minute)
		defer cancel()
		h.Syncer.ReindexAll(bg) // titles 已空 → 清空搜索索引
	}()
	slog.Warn("content reset: all titles wiped, ids restarted")
	return response.OK(c, map[string]any{"reset": true})
}

// AdminReclassify 按各源分类树重算全部作品的 kind/adult（如新增「AI漫剧→短剧」规则后纠正存量）。
// 量大、需拉各源分类树，后台异步跑。
func (h *Handler) AdminReclassify(c echo.Context) error {
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
		defer cancel()
		n := h.Syncer.ReclassifyAll(ctx)
		slog.Info("reclassify done", "changed", n)
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

// CleanupFakeNamed 清理「蹭真剧名的成人条目」：成人作品 + 库里有同名(norm_title)的非成人真作品
//（如 亢奋/鬼作秀/羞耻——ikun 起成真剧名、被 TMDB 误匹配拉了真剧评分/海报混进里番/伦理）。
// 真·里番/伦理(名字独特、无同名真剧)不受影响。dry=1(默认) 只列清单；dry=0 级联删除。
func (h *Handler) CleanupFakeNamed(c echo.Context) error {
	ctx := c.Request().Context()
	dry := c.QueryParam("dry") != "0"

	type item struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
		Kind int16  `json:"kind"`
		Year int    `json:"year"`
	}
	// 只删「抄了电视剧/综艺/体育名」的成人条目——色情片绝不会和这些正当重名。
	// 排除：电影/动漫(真伦理/里番常正当重名)、短剧(名字风格和成人标题高度重叠，会误伤真 JAV)。
	// kind 参数：限定被删条目的 kind（如 4=只清里番，最稳；不传=里番+伦理都清）。
	q := h.DB.WithContext(ctx).Model(&model.Title{}).
		Select("id, name, kind, year").
		Where(`adult = true AND norm_title <> '' AND EXISTS (
			SELECT 1 FROM titles t2 WHERE t2.norm_title = titles.norm_title
			AND t2.adult = false AND t2.kind IN (2,3,7))`)
	if k := qInt(c, "kind", 0); k > 0 {
		q = q.Where("kind = ?", k)
	}
	var hits []item
	q.Scan(&hits)

	if !dry {
		for _, a := range hits {
			h.DB.WithContext(ctx).Exec(`DELETE FROM episodes WHERE title_id = ?`, a.ID)
			h.DB.WithContext(ctx).Exec(`DELETE FROM play_sources WHERE title_id = ?`, a.ID)
			h.DB.WithContext(ctx).Exec(`DELETE FROM source_items WHERE title_id = ?`, a.ID)
			h.DB.WithContext(ctx).Exec(`DELETE FROM title_aliases WHERE title_id = ?`, a.ID)
			h.DB.WithContext(ctx).Exec(`DELETE FROM titles WHERE id = ?`, a.ID)
			h.Syncer.RemoveFromIndex(ctx, a.ID)
		}
	}
	out := hits
	if len(out) > 800 {
		out = out[:800]
	}
	return response.OK(c, map[string]any{"dry_run": dry, "count": len(hits), "items": out})
}

// CleanupEmptyLifan 清理里番空壳：成人作品里没有任何播放源的（死链/空条目）。
// 判据=有播放源就留(ikun 等源的里番都算合法)，没播放源的才是垃圾。
// dry=1(默认) 只列清单不删；dry=0 级联删除。
func (h *Handler) CleanupEmptyLifan(c echo.Context) error {
	ctx := c.Request().Context()
	dry := c.QueryParam("dry") != "0"

	type item struct {
		ID   int64  `json:"id"`
		Name string `json:"name"`
		Kind int16  `json:"kind"`
		Year int    `json:"year"`
	}
	var hits []item
	h.DB.WithContext(ctx).Model(&model.Title{}).
		Select("id, name, kind, year").
		Where("adult = true AND NOT EXISTS (SELECT 1 FROM play_sources p WHERE p.title_id = titles.id)").
		Scan(&hits)

	if !dry {
		for _, a := range hits {
			h.DB.WithContext(ctx).Exec(`DELETE FROM episodes WHERE title_id = ?`, a.ID)
			h.DB.WithContext(ctx).Exec(`DELETE FROM source_items WHERE title_id = ?`, a.ID)
			h.DB.WithContext(ctx).Exec(`DELETE FROM title_aliases WHERE title_id = ?`, a.ID)
			h.DB.WithContext(ctx).Exec(`DELETE FROM titles WHERE id = ?`, a.ID)
			h.Syncer.RemoveFromIndex(ctx, a.ID)
		}
	}
	out := hits
	if len(out) > 500 {
		out = out[:500]
	}
	return response.OK(c, map[string]any{"dry_run": dry, "count": len(hits), "items": out})
}

// ---- 去重复核与人工合并 ----

// ReviewList 列出待人工复核的采集记录（灰区匹配）。
// 富化：补「归类作品名」+「疑似重复候选(系统模糊召回最像的另一条)名+相似分」，供人工一眼判断该不该合并。
func (h *Handler) ReviewList(c echo.Context) error {
	ctx := c.Request().Context()
	page, size := qInt(c, "page", 1), qInt(c, "size", 24)
	q := h.DB.WithContext(ctx).Model(&model.SourceItem{}).Where("needs_review = true")
	var total int64
	q.Count(&total)
	var list []model.SourceItem
	q.Order("updated_at DESC").Offset((page - 1) * size).Limit(size).Find(&list)

	type reviewItem struct {
		model.SourceItem
		TitleName      string  `json:"title_name"`
		CandidateID    int64   `json:"candidate_id"`
		CandidateName  string  `json:"candidate_name"`
		CandidateScore float32 `json:"candidate_score"`
	}
	out := make([]reviewItem, len(list))
	for i, it := range list {
		ri := reviewItem{SourceItem: it}
		if it.TitleID != nil {
			var t model.Title
			if err := h.DB.WithContext(ctx).First(&t, *it.TitleID).Error; err == nil {
				ri.TitleName = t.Name
				if cid, score, ok := h.Syncer.FindDuplicate(ctx, &t); ok {
					ri.CandidateID, ri.CandidateScore = cid, score
					h.DB.WithContext(ctx).Model(&model.Title{}).Where("id = ?", cid).Pluck("name", &ri.CandidateName)
				}
			}
		}
		out[i] = ri
	}
	return response.Page(c, out, total, page, size)
}

// ReviewKeep 把某复核作品标记为「已复核·确认独立」：清掉其所有采集项的 needs_review，移出队列。
func (h *Handler) ReviewKeep(c echo.Context) error {
	tid := paramInt64(c, "id") // title_id
	if tid <= 0 {
		return response.BadRequest(c, "参数错误")
	}
	h.DB.WithContext(c.Request().Context()).Model(&model.SourceItem{}).
		Where("title_id = ?", tid).Update("needs_review", false)
	return response.OK(c, map[string]any{"ok": true})
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

// DedupByURL 强信号去重：复核作品与库里其他作品共享 ≥min_shared 个相同播放 URL → 判为同一部
//（同一 m3u8 流=同一视频内容，高精度），合并(保留 source_count 高的)。短剧无外部 ID，URL 是最可靠信号。
// 一次性批量 join 找配对(扫一遍 episodes)，不逐条查。dry=1 默认只产出方案；dry=0 异步执行。
func (h *Handler) DedupByURL(c echo.Context) error {
	dry := c.QueryParam("dry") != "0"
	minShared := qInt(c, "min_shared", 2)
	if dry {
		return response.OK(c, h.runDedupURL(c.Request().Context(), minShared, true))
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Hour)
		defer cancel()
		res := h.runDedupURL(ctx, minShared, false)
		slog.Info("dedup-url done", "merged", res.Merged, "min_shared", minShared)
	}()
	return response.OK(c, map[string]any{"started": true, "min_shared": minShared})
}

func (h *Handler) runDedupURL(ctx context.Context, minShared int, dry bool) *autoReviewResult {
	res := &autoReviewResult{DryRun: dry}
	var reviewIDs []int64
	h.DB.WithContext(ctx).Model(&model.SourceItem{}).
		Where("needs_review = true AND title_id IS NOT NULL").
		Distinct().Pluck("title_id", &reviewIDs)
	if len(reviewIDs) == 0 {
		return res
	}
	type pair struct {
		A      int64
		B      int64
		Shared int
	}
	var pairs []pair
	// 复核作品(e1)与任意其他作品(e2)共享相同 URL，按共享数聚合
	h.DB.WithContext(ctx).Raw(`
		SELECT e1.title_id AS a, e2.title_id AS b, count(DISTINCT e1.url) AS shared
		FROM episodes e1
		JOIN episodes e2 ON e2.url = e1.url AND e2.title_id <> e1.title_id
		WHERE e1.title_id IN ? AND e1.url <> ''
		GROUP BY e1.title_id, e2.title_id
		HAVING count(DISTINCT e1.url) >= ?`, reviewIDs, minShared).Scan(&pairs)
	// 每条复核作品取共享最多的那个对手
	best := map[int64]pair{}
	for _, p := range pairs {
		if cur, ok := best[p.A]; !ok || p.Shared > cur.Shared {
			best[p.A] = p
		}
	}
	seen := map[[2]int64]bool{} // 互配去重(a,b)与(b,a)只处理一次
	for a, p := range best {
		lo, hi := a, p.B
		if hi < lo {
			lo, hi = hi, lo
		}
		if seen[[2]int64{lo, hi}] {
			continue
		}
		seen[[2]int64{lo, hi}] = true
		res.Scanned++
		from, to, valid := h.mergeDirection(ctx, a, p.B)
		if !valid {
			continue
		}
		if dry {
			if len(res.Proposals) < 500 {
				var fn, tn string
				h.DB.WithContext(ctx).Model(&model.Title{}).Where("id = ?", from).Pluck("name", &fn)
				h.DB.WithContext(ctx).Model(&model.Title{}).Where("id = ?", to).Pluck("name", &tn)
				res.Proposals = append(res.Proposals, AutoReviewProposal{FromID: from, ToID: to, FromName: fn, ToName: tn, Score: float32(p.Shared)})
			}
			res.Merged++
			continue
		}
		if err := h.Repo.MergeTitles(ctx, from, to); err != nil {
			slog.Error("dedup-url merge failed", "from", from, "to", to, "err", err)
			continue
		}
		h.DB.WithContext(ctx).Model(&model.SourceItem{}).Where("title_id = ?", to).Update("needs_review", false)
		h.Title.InvalidateDetail(ctx, from)
		h.Title.InvalidateDetail(ctx, to)
		h.Syncer.RemoveFromIndex(ctx, from)
		res.Merged++
	}
	return res
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
