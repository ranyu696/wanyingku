package collect

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"time"

	"gorm.io/gorm"
)

// Prober 播放源探活：取每条线路首集的 m3u8 探活，更新 health/latency，死链沉底。
type Prober struct {
	db          *gorm.DB
	http        *http.Client
	ua          string
	concurrency int
}

func NewProber(db *gorm.DB, ua string, concurrency int) *Prober {
	if concurrency < 1 {
		concurrency = 8
	}
	if ua == "" {
		ua = "Mozilla/5.0"
	}
	return &Prober{
		db:          db,
		http:        &http.Client{Timeout: 8 * time.Second},
		ua:          ua,
		concurrency: concurrency,
	}
}

type probeTarget struct {
	PsID int64  `gorm:"column:ps_id"`
	URL  string `gorm:"column:url"`
}

// ProbeAll 探活全部（或前 limit 条）播放源的首集。返回 已检查/存活/失败 计数。
// 探测三态：存活 / 防盗链挡(主机活着但拒绝服务端探测，归未知) / 死链
type probeRes int

const (
	resAlive probeRes = iota
	resBlocked
	resDead
)

func (p *Prober) ProbeAll(ctx context.Context, limit int) (checked, alive, blocked, dead int) {
	var targets []probeTarget
	p.db.WithContext(ctx).Raw(`
		SELECT DISTINCT ON (ps.id) ps.id AS ps_id, e.url AS url
		FROM play_sources ps JOIN episodes e ON e.play_source_id = ps.id
		WHERE e.url <> ''
		ORDER BY ps.id, e.idx ASC`).Scan(&targets)
	if limit > 0 && len(targets) > limit {
		targets = targets[:limit]
	}
	slog.Info("probe start", "targets", len(targets), "concurrency", p.concurrency)

	sem := make(chan struct{}, p.concurrency)
	var mu sync.Mutex
	var wg sync.WaitGroup
	for i := range targets {
		select {
		case <-ctx.Done():
			wg.Wait()
			return
		case sem <- struct{}{}:
		}
		wg.Add(1)
		go func(t probeTarget) {
			defer wg.Done()
			defer func() { <-sem }()
			ms, res := p.probe(ctx, t.URL)
			p.update(ctx, t.PsID, ms, res)
			mu.Lock()
			checked++
			switch res {
			case resAlive:
				alive++
			case resBlocked:
				blocked++
			default:
				dead++
			}
			mu.Unlock()
		}(targets[i])
	}
	wg.Wait()
	slog.Info("probe done", "checked", checked, "alive", alive, "blocked", blocked, "dead", dead)
	return
}

func (p *Prober) probe(ctx context.Context, url string) (int, probeRes) {
	start := time.Now()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return 0, resDead
	}
	req.Header.Set("User-Agent", p.ua)
	resp, err := p.http.Do(req)
	if err != nil {
		return 0, resDead
	}
	defer resp.Body.Close()
	ms := int(time.Since(start).Milliseconds())
	switch resp.StatusCode {
	case http.StatusOK, http.StatusPartialContent:
		buf, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		// m3u8 playlist 可达即存活；非 m3u8 直链(.mp4)只要 200 也算
		if strings.Contains(string(buf), "#EXTM3U") || strings.Contains(strings.ToLower(url), ".mp4") {
			return ms, resAlive
		}
		return ms, resDead // 200 但不是 m3u8，多半是拦截页
	case http.StatusForbidden, http.StatusUnauthorized, http.StatusUnavailableForLegalReasons:
		return ms, resBlocked // 防盗链/鉴权挡了服务端探测，主机活着，浏览器带正确 referer 可能能播
	default:
		return ms, resDead
	}
}

func (p *Prober) update(ctx context.Context, psID int64, ms int, res probeRes) {
	switch res {
	case resAlive:
		p.db.WithContext(ctx).Exec(
			`UPDATE play_sources SET health=1, latency_ms=?, fail_count=0, last_checked_at=now() WHERE id=?`, ms, psID)
	case resBlocked:
		// 主机活但防盗链，归"未知"(0)，不沉底、不计延迟，重置失败计数
		p.db.WithContext(ctx).Exec(
			`UPDATE play_sources SET health=0, fail_count=0, last_checked_at=now() WHERE id=?`, psID)
	default:
		// 连续失败 ≥2 次才判死链，避免偶发超时误杀
		p.db.WithContext(ctx).Exec(
			`UPDATE play_sources SET health = CASE WHEN fail_count + 1 >= 2 THEN -1 ELSE 0 END,
			 fail_count = fail_count + 1, last_checked_at = now() WHERE id = ?`, psID)
	}
}
