package collect

import (
	"context"
	"encoding/json"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/lib/pq"
	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/internal/service/push"
	"github.com/xiaoxin/cms/internal/service/resolve"
	"github.com/xiaoxin/cms/internal/service/search"
	"github.com/xiaoxin/cms/pkg/textutil"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// Syncer 编排：采集 → 归类去重 → 播放源/剧集入库 → 聚合 → 订阅通知/推送 → 搜索索引。
type Syncer struct {
	db     *gorm.DB
	mac    *MacCMSClient
	engine *resolve.Engine
	search *search.Service
	cfg    config.Collect
	push   *push.Service
}

func NewSyncer(db *gorm.DB, mac *MacCMSClient, engine *resolve.Engine, search *search.Service, cfg config.Collect, pushSvc *push.Service) *Syncer {
	return &Syncer{db: db, mac: mac, engine: engine, search: search, cfg: cfg, push: pushSvc}
}

type Stats struct {
	Pages     int `json:"pages"`
	Items     int `json:"items"`
	NewTitles int `json:"new_titles"`
	Merged    int `json:"merged"`
	Errors    int `json:"errors"`
}

const defaultMaxPages = 2000

// SyncSource 采集单个源。full=true 全量，否则按距上次同步的小时数增量。
func (s *Syncer) SyncSource(ctx context.Context, src *model.Source, full bool) (*Stats, error) {
	hours := 0
	if !full && src.LastSyncAt != nil {
		h := int(time.Since(*src.LastSyncAt).Hours()) + 1
		if h < 1 {
			h = 1
		}
		if h > 24*7 {
			h = 0 // 太久没同步，转全量
		}
		hours = h
	}

	limit := s.cfg.MaxPages
	if limit <= 0 {
		limit = defaultMaxPages
	}
	stats := &Stats{}
	affected := make(map[int64]struct{})
	// 顶级分类树要单独用 ac=list 取（videolist 不返回 class）
	typeRoots := s.fetchTypeRoots(ctx, src.APIURL)
	page := 1
	consecFail := 0
	for page <= limit {
		select {
		case <-ctx.Done():
			return stats, ctx.Err()
		default:
		}
		resp, err := s.mac.FetchList(ctx, src.APIURL, ListOptions{Page: page, Hours: hours})
		if err != nil {
			slog.Warn("collect fetch failed", "source", src.Name, "page", page, "err", err)
			stats.Errors++
			consecFail++
			if consecFail >= 3 { // 连续 3 页失败才放弃整源，单页抖动跳过继续
				break
			}
			page++
			continue
		}
		consecFail = 0
		if len(resp.List) == 0 {
			break
		}
		for i := range resp.List {
			// 叶子优先、顶级分类兜底：如「现代都市」挂在「短剧大全」下 → 短剧
			root := typeRoots[resp.List[i].TypeID.Int()]
			tid, created, err := s.processItem(ctx, src, &resp.List[i], root)
			stats.Items++
			if err != nil {
				stats.Errors++
				continue
			}
			if created {
				stats.NewTitles++
			} else {
				stats.Merged++
			}
			if tid > 0 {
				affected[tid] = struct{}{}
			}
		}
		stats.Pages++
		if pc := resp.PageCount.Int(); pc > 0 && page >= pc {
			break
		}
		if s.cfg.PageDelayMs > 0 {
			select {
			case <-ctx.Done():
				return stats, ctx.Err()
			case <-time.After(time.Duration(s.cfg.PageDelayMs) * time.Millisecond):
			}
		}
		page++
	}

	now := time.Now()
	upd := map[string]any{"last_sync_at": now, "updated_at": now}
	if full {
		upd["last_full_sync_at"] = now
	}
	s.db.WithContext(ctx).Model(&model.Source{}).Where("id = ?", src.ID).Updates(upd)

	s.retagAffected(ctx, affected)
	s.retagShortDramas(ctx, affected)
	s.reindex(ctx, affected)
	s.fulfillRequests(ctx)
	slog.Info("source synced", "source", src.Name, "items", stats.Items,
		"new", stats.NewTitles, "merged", stats.Merged, "errors", stats.Errors)
	return stats, nil
}

func (s *Syncer) processItem(ctx context.Context, src *model.Source, item *VodItem, root string) (int64, bool, error) {
	name := strings.TrimSpace(item.VodName)
	if name == "" {
		return 0, false, nil
	}
	if IsJunkType(item.TypeName) || IsJunkType(root) {
		return 0, false, nil // 新闻/预告等噪声，不入库
	}
	kind := ClassifyKind(item.TypeName, root) // 叶子优先，顶级分类兜底
	groups := ParsePlay(item.VodPlayFrom, item.VodPlayURL)
	// 短剧纠偏：被判电影但分集很多 → 短剧（源常把微短剧挂在电影/泛题材下）。
	kind = FixShortByEpisodes(kind, MaxEpisodes(groups))
	year := item.Year()
	if year == 0 {
		year = textutil.ExtractYear(name)
	}
	norm := textutil.Normalize(name)

	res, err := s.engine.Resolve(ctx, resolve.Input{
		Name:      name,
		NormTitle: norm,
		Kind:      kind,
		Year:      year,
		Overview:  textutil.CleanHTML(item.VodContent),
		Director:  item.VodDirector,
		Actors:    item.VodActor,
		Area:      item.VodArea,
		Pic:       item.VodPic,
	})
	if err != nil {
		return 0, false, err
	}

	si := &model.SourceItem{
		SourceID:        src.ID,
		VodID:           string(item.VodID),
		TypeID:          item.TypeID.Int(),
		TypeName:        item.TypeName,
		Name:            name,
		SubName:         item.VodSub,
		EnName:          item.VodEn,
		Year:            year,
		Area:            item.VodArea,
		Lang:            item.VodLang,
		Remarks:         item.VodRemarks,
		Actors:          item.VodActor,
		Director:        item.VodDirector,
		Content:         item.VodContent,
		Pic:             item.VodPic,
		PlayFrom:        item.VodPlayFrom,
		PlayURL:         item.VodPlayURL,
		TitleID:         &res.TitleID,
		MatchMethod:     res.Method,
		MatchConfidence: res.Confidence,
		NeedsReview:     res.NeedsReview,
		VodTime:         ParseVodTime(item.VodTime),
	}
	if raw, e := json.Marshal(item); e == nil {
		si.Raw = model.JSON(raw)
	}
	if err := s.upsertSourceItem(ctx, si); err != nil {
		return res.TitleID, res.Created, err
	}

	s.writePlay(ctx, src, res.TitleID, si.ID, groups, item)
	s.updateTitleAggregates(ctx, res.TitleID, item)
	if IsAdult(item.TypeName) || IsAdult(root) { // 成人内容打标记（伦理片/里番），叶子+顶级都查
		s.db.WithContext(ctx).Model(&model.Title{}).Where("id = ?", res.TitleID).Update("adult", true)
	}
	s.notifySubscribers(ctx, res.TitleID)

	return res.TitleID, res.Created, nil
}

func (s *Syncer) upsertSourceItem(ctx context.Context, si *model.SourceItem) error {
	err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "source_id"}, {Name: "vod_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"type_id", "type_name", "name", "sub_name", "en_name", "year", "area", "lang",
			"remarks", "actors", "director", "content", "pic", "play_from", "play_url",
			"raw", "title_id", "match_method", "match_confidence", "needs_review", "vod_time", "updated_at",
		}),
	}).Create(si).Error
	if err != nil {
		return err
	}
	if si.ID == 0 {
		s.db.WithContext(ctx).Model(&model.SourceItem{}).
			Where("source_id = ? AND vod_id = ?", si.SourceID, si.VodID).
			Select("id").Scan(&si.ID)
	}
	return nil
}

func (s *Syncer) writePlay(ctx context.Context, src *model.Source, titleID, sourceItemID int64, groups []PlayGroup, item *VodItem) {
	for _, g := range groups {
		lang := textutil.DetectLang(g.Flag)
		if lang == "" {
			lang = textutil.DetectLang(item.VodName)
		}
		if lang == "" {
			lang = textutil.DetectLang(item.VodLang) // 先归一：普通话/汉语普通话 → 国语
		}
		if lang == "" {
			lang = strings.TrimSpace(item.VodLang) // 兜底存原始（如泰语/法语等映射表外的）
		}
		ps := &model.PlaySource{
			TitleID:      titleID,
			SourceID:     src.ID,
			SourceItemID: &sourceItemID,
			Flag:         g.Flag,
			Lang:         lang,
			EpisodeCount: len(g.Episodes),
			Weight:       src.Weight,
		}
		err := s.db.WithContext(ctx).Clauses(clause.OnConflict{
			Columns:   []clause.Column{{Name: "title_id"}, {Name: "source_id"}, {Name: "flag"}},
			DoUpdates: clause.AssignmentColumns([]string{"lang", "episode_count", "weight", "source_item_id", "updated_at"}),
		}).Create(ps).Error
		if err != nil {
			slog.Warn("write play_source failed", "title", titleID, "err", err)
			continue
		}
		if ps.ID == 0 {
			s.db.WithContext(ctx).Model(&model.PlaySource{}).
				Where("title_id = ? AND source_id = ? AND flag = ?", titleID, src.ID, g.Flag).
				Select("id").Scan(&ps.ID)
		}
		// 整组替换剧集
		s.db.WithContext(ctx).Where("play_source_id = ?", ps.ID).Delete(&model.Episode{})
		// 用位置序号作为 idx，保证同一线路内唯一（集名可能解析出重复集号，
		// 如「先导片」「第01期」都→1，会触发 ON CONFLICT 同行二次更新错误）。
		eps := make([]model.Episode, 0, len(g.Episodes))
		for i, e := range g.Episodes {
			eps = append(eps, model.Episode{
				PlaySourceID: ps.ID, TitleID: titleID, Idx: i + 1, Name: e.Name, URL: e.URL,
			})
		}
		if len(eps) > 0 {
			s.db.WithContext(ctx).Clauses(clause.OnConflict{
				Columns:   []clause.Column{{Name: "play_source_id"}, {Name: "idx"}},
				DoUpdates: clause.AssignmentColumns([]string{"name", "url"}),
			}).Create(&eps)
		}
	}
}

func (s *Syncer) updateTitleAggregates(ctx context.Context, titleID int64, item *VodItem) {
	s.db.WithContext(ctx).Exec(`
		UPDATE titles t SET
			source_count = (SELECT count(DISTINCT source_id) FROM play_sources WHERE title_id = t.id),
			latest_episode = COALESCE((SELECT max(episode_count) FROM play_sources WHERE title_id = t.id), 0),
			updated_at = now()
		WHERE t.id = ?`, titleID)

	if strings.Contains(item.VodRemarks, "完结") || strings.Contains(item.VodRemarks, "全集") {
		s.db.WithContext(ctx).Model(&model.Title{}).Where("id = ?", titleID).Update("serial_complete", true)
	}
	if item.VodPic != "" {
		s.db.WithContext(ctx).Exec(
			`UPDATE titles SET poster = ? WHERE id = ? AND (poster IS NULL OR poster = '')`, item.VodPic, titleID)
	}
	if item.VodContent != "" {
		s.db.WithContext(ctx).Exec(
			`UPDATE titles SET overview = ? WHERE id = ? AND (overview IS NULL OR overview = '')`,
			textutil.CleanHTML(item.VodContent), titleID)
	}
	if item.VodDirector != "" {
		s.db.WithContext(ctx).Exec(
			`UPDATE titles SET director = ? WHERE id = ? AND (director IS NULL OR director = '')`, item.VodDirector, titleID)
	}
	if item.VodActor != "" {
		s.db.WithContext(ctx).Exec(
			`UPDATE titles SET actors = ? WHERE id = ? AND (actors IS NULL OR actors = '')`, item.VodActor, titleID)
	}
	if item.VodArea != "" {
		s.db.WithContext(ctx).Exec(
			`UPDATE titles SET area = ? WHERE id = ? AND (area IS NULL OR area = '')`, item.VodArea, titleID)
	}
}

// notifySubscribers 订阅更新：剧集类作品集数增加时，给订阅者发站内通知 + FCM 推送。
// 按规范作品的 kind 过滤（排除电影），不依赖每条源项的 GuessKind 猜测，避免误判漏发。
func (s *Syncer) notifySubscribers(ctx context.Context, titleID int64) {
	// INSERT ... RETURNING 拿到刚生成的通知行，用于推送
	type notified struct {
		UserID int64
		Title  string
		Body   string
		RefID  int64
	}
	var rows []notified
	s.db.WithContext(ctx).Raw(`
		INSERT INTO notifications (user_id, kind, title, body, ref_id)
		SELECT s.user_id, 1, t.name || ' 更新', '已更新至第 ' || t.latest_episode || ' 集', t.id
		FROM subscriptions s JOIN titles t ON t.id = s.title_id
		WHERE s.title_id = ? AND t.kind <> ? AND t.latest_episode > s.last_notified_episode
		RETURNING user_id, title, body, ref_id`, titleID, model.KindMovie).Scan(&rows)
	s.db.WithContext(ctx).Exec(`
		UPDATE subscriptions s SET last_notified_episode = t.latest_episode
		FROM titles t WHERE t.id = s.title_id AND s.title_id = ? AND t.latest_episode > s.last_notified_episode`, titleID)

	if s.push != nil && s.push.Enabled() {
		for _, r := range rows {
			s.push.SendToUser(ctx, r.UserID, r.Title, r.Body,
				map[string]string{"type": "subscription", "title_id": strconv.FormatInt(r.RefID, 10)})
		}
	}
}

// fulfillRequests 采集后批量闭环：待处理/处理中的求片若已被采集到（归一片名命中作品），
// 自动标记为「已满足」并关联作品 + 给发起人发站内通知。一次采集跑一遍，按归一片名索引，开销很小。
func (s *Syncer) fulfillRequests(ctx context.Context) {
	s.db.WithContext(ctx).Exec(`
		WITH matched AS (
			UPDATE requests r SET status = ?, title_id = t.id, updated_at = now()
			FROM titles t
			WHERE r.status IN (?, ?)
			  AND r.norm_name <> ''
			  AND r.norm_name = t.norm_title
			  AND (r.year = 0 OR r.year = t.year)
			  AND t.status = 1
			RETURNING r.user_id, r.name, t.id AS tid
		)
		INSERT INTO notifications (user_id, kind, title, body, ref_id)
		SELECT user_id, 2, '求片已满足：' || name, '你求的《' || name || '》已经可以观看了', tid
		FROM matched WHERE user_id IS NOT NULL`,
		model.ReqDone, model.ReqPending, model.ReqProcessing)
}

// retagAffected 重算受影响作品的标签（从 source_items.raw->>'vod_class' 提取），独立于搜索索引。
// 短剧（kind=6）除外：其 vod_class 基本只有「短剧」二字，题材另由 retagShortDramas 从片名抽取。
func (s *Syncer) retagAffected(ctx context.Context, ids map[int64]struct{}) {
	if len(ids) == 0 {
		return
	}
	list := make([]int64, 0, len(ids))
	for id := range ids {
		list = append(list, id)
	}
	s.db.WithContext(ctx).Exec(`
		UPDATE titles t SET tags = COALESCE(sub.tags, '{}') FROM (
			SELECT ps.title_id, array_agg(DISTINCT btrim(tag)) AS tags
			FROM play_sources ps JOIN source_items si ON si.id = ps.source_item_id
			CROSS JOIN LATERAL regexp_split_to_table(coalesce(si.raw->>'vod_class', ''), '[,，/、]') AS tag
			WHERE btrim(tag) <> '' AND ps.title_id IN ?
			GROUP BY ps.title_id
		) sub WHERE t.id = sub.title_id AND t.kind <> ?`, list, model.KindShort)
}

// retagShortDramas 给受影响的短剧从片名+简介抽取题材标签（覆盖式写入 tags）。
func (s *Syncer) retagShortDramas(ctx context.Context, ids map[int64]struct{}) {
	if len(ids) == 0 {
		return
	}
	list := make([]int64, 0, len(ids))
	for id := range ids {
		list = append(list, id)
	}
	s.applyShortTags(ctx, `SELECT id, name, coalesce(overview,'') AS overview
		FROM titles WHERE kind = ? AND id IN ?`, model.KindShort, list)
}

// BackfillShortTags 给全部短剧重算题材标签（worker -shorttags 触发），返回处理条数。
func (s *Syncer) BackfillShortTags(ctx context.Context) int {
	return s.applyShortTags(ctx, `SELECT id, name, coalesce(overview,'') AS overview
		FROM titles WHERE kind = ?`, model.KindShort)
}

// applyShortTags 跑给定查询取出的短剧，逐条把题材词表抽到的标签覆盖写回 tags。
func (s *Syncer) applyShortTags(ctx context.Context, query string, args ...any) int {
	type row struct {
		ID       int64
		Name     string
		Overview string
	}
	var rows []row
	s.db.WithContext(ctx).Raw(query, args...).Scan(&rows)
	for _, r := range rows {
		s.db.WithContext(ctx).Exec(`UPDATE titles SET tags = ? WHERE id = ?`,
			pq.StringArray(ShortDramaTopics(r.Name, r.Overview)), r.ID)
	}
	return len(rows)
}

// fetchTypeRoots 用 ac=list 取分类树并构建 type_id→顶级分类名（videolist 不返回 class）。
func (s *Syncer) fetchTypeRoots(ctx context.Context, apiURL string) map[int]string {
	resp, err := s.mac.FetchList(ctx, apiURL, ListOptions{Action: "list"})
	if err != nil || len(resp.Class) == 0 {
		return nil
	}
	return RootCategories(resp.Class)
}

// ReclassifyAll 用各源分类树重算所有作品的 kind/adult（worker -reclassify 触发，返回改动条数）。
// 历史数据里短剧被源的子分类（如「现代都市」其实挂在「短剧大全」下）误判成电影，这里纠正。
func (s *Syncer) ReclassifyAll(ctx context.Context) int {
	var srcs []model.Source
	s.db.WithContext(ctx).Find(&srcs)
	roots := map[int]map[int]string{}
	for i := range srcs {
		if m := s.fetchTypeRoots(ctx, srcs[i].APIURL); m != nil {
			roots[srcs[i].ID] = m
		}
	}

	type itemRow struct {
		TitleID  int64
		SourceID int
		TypeID   int
		TypeName string
	}
	var rows []itemRow
	s.db.WithContext(ctx).Raw(
		`SELECT title_id, source_id, type_id, type_name FROM source_items WHERE title_id IS NOT NULL`).Scan(&rows)

	type agg struct {
		kinds map[int16]int
		adult bool
	}
	titles := map[int64]*agg{}
	for _, r := range rows {
		root := ""
		if m := roots[r.SourceID]; m != nil {
			root = m[r.TypeID]
		}
		a := titles[r.TitleID]
		if a == nil {
			a = &agg{kinds: map[int16]int{}}
			titles[r.TitleID] = a
		}
		a.kinds[ClassifyKind(r.TypeName, root)]++
		if IsAdult(r.TypeName) || IsAdult(root) {
			a.adult = true
		}
	}

	n := 0
	for tid, a := range titles {
		k := pickKind(a.kinds)
		res := s.db.WithContext(ctx).Exec(
			`UPDATE titles SET kind = ?, adult = ? WHERE id = ? AND (kind <> ? OR adult <> ?)`,
			k, a.adult, tid, k, a.adult)
		if res.RowsAffected > 0 {
			n++
		}
	}
	return n
}

// pickKind 从一部作品各源条目的 kind 里选最终类型：取出现最多的；并列时偏向非电影（电影是兜底默认）。
func pickKind(kinds map[int16]int) int16 {
	best := int16(model.KindMovie)
	bestN := 0
	for k, c := range kinds {
		if c > bestN || (c == bestN && best == model.KindMovie && k != model.KindMovie) {
			best, bestN = k, c
		}
	}
	return best
}

// EmbedAll 给全部作品补 AI 向量（worker -embed 触发，需向量层开启）。
func (s *Syncer) EmbedAll(ctx context.Context) int {
	return s.engine.EmbedAll(ctx)
}

// BackfillSlugs 给所有空 slug 的作品补拼音 slug。
func (s *Syncer) BackfillSlugs(ctx context.Context) int {
	return s.engine.BackfillSlugs(ctx)
}

// BackfillOverview 清洗历史简介里夹带的 HTML 标签。
func (s *Syncer) BackfillOverview(ctx context.Context) int {
	return s.engine.BackfillOverview(ctx)
}

// ReindexAll 全量重建 Meili 索引（管理端触发）。返回已索引作品数。
func (s *Syncer) ReindexAll(ctx context.Context) int {
	s.search.DeleteAllDocs(ctx) // 先清空，避免合并/删除遗留的死文档残留
	var ids []int64
	s.db.WithContext(ctx).Model(&model.Title{}).Where("status = 1").Pluck("id", &ids)
	set := make(map[int64]struct{}, len(ids))
	for _, id := range ids {
		set[id] = struct{}{}
	}
	s.reindex(ctx, set) // 内部已判 Meili 是否启用
	return len(ids)
}

// RemoveFromIndex 从搜索索引删除某作品（合并/删除作品时调用，避免搜出已不存在的条目）。
func (s *Syncer) RemoveFromIndex(ctx context.Context, id int64) {
	s.search.DeleteDoc(ctx, id)
}

func (s *Syncer) reindex(ctx context.Context, ids map[int64]struct{}) {
	if !s.search.Enabled() || len(ids) == 0 {
		return
	}
	list := make([]int64, 0, len(ids))
	for id := range ids {
		list = append(list, id)
	}
	const chunk = 500
	for i := 0; i < len(list); i += chunk {
		end := i + chunk
		if end > len(list) {
			end = len(list)
		}
		var titles []model.Title
		s.db.WithContext(ctx).Where("id IN ? AND status = 1", list[i:end]).Find(&titles)
		docs := make([]search.TitleDoc, 0, len(titles))
		for j := range titles {
			var aliases []string
			s.db.WithContext(ctx).Model(&model.TitleAlias{}).
				Where("title_id = ?", titles[j].ID).Limit(20).Pluck("alias", &aliases)
			docs = append(docs, search.BuildDoc(&titles[j], aliases))
		}
		if err := s.search.IndexDocs(ctx, docs); err != nil {
			slog.Warn("reindex failed", "err", err)
		}
	}
}
