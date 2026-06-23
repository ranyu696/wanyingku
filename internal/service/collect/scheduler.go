package collect

import (
	"context"
	"log/slog"
	"time"

	"github.com/xiaoxin/cms/internal/model"
	"gorm.io/gorm"
)

// Scheduler 定时扫描到期的采集源并增量采集；并独立定时探活播放源。
type Scheduler struct {
	db          *gorm.DB
	syncer      *Syncer
	concurrency int
	tick        time.Duration
	prober      *Prober
	probeTick   time.Duration // 0=关闭探活
}

func NewScheduler(db *gorm.DB, syncer *Syncer, concurrency int, ua string, probeIntervalHours int) *Scheduler {
	if concurrency < 1 {
		concurrency = 2
	}
	s := &Scheduler{db: db, syncer: syncer, concurrency: concurrency, tick: 5 * time.Minute}
	if probeIntervalHours > 0 {
		s.prober = NewProber(db, ua, concurrency)
		s.probeTick = time.Duration(probeIntervalHours) * time.Hour
	}
	return s
}

// RunProbe 独立于采集调度：定时探活全部播放源，刷新 health/latency。
// 与采集调度解耦——采集可关、探活照常跑。
func (s *Scheduler) RunProbe(ctx context.Context) {
	if s.prober == nil || s.probeTick <= 0 {
		return
	}
	slog.Info("probe scheduler started", "interval", s.probeTick.String())
	// 启动后延迟 30s 首跑，避开启动高峰
	t := time.NewTimer(30 * time.Second)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			slog.Info("probe scheduler stopped")
			return
		case <-t.C:
			s.prober.ProbeAll(ctx, 0)
			t.Reset(s.probeTick)
		}
	}
}

// RunIndexNow 每日向 IndexNow 提交近 2 天更新的作品页（增量收录通知）。未配置 site/key 则不启动。
func (s *Scheduler) RunIndexNow(ctx context.Context, site, key string) {
	if site == "" || key == "" {
		return
	}
	const tick = 24 * time.Hour
	slog.Info("indexnow scheduler started", "interval", tick.String())
	t := time.NewTimer(2 * time.Minute) // 启动 2 分钟后首跑，避开启动高峰
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			slog.Info("indexnow scheduler stopped")
			return
		case <-t.C:
			n, code, err := SubmitIndexNow(ctx, s.db, site, key, 2)
			if err != nil {
				slog.Error("indexnow submit failed", "err", err)
			} else {
				slog.Info("indexnow submitted", "urls", n, "status", code)
			}
			t.Reset(tick)
		}
	}
}

func (s *Scheduler) Run(ctx context.Context) {
	slog.Info("collect scheduler started", "concurrency", s.concurrency, "tick", s.tick.String())
	t := time.NewTicker(s.tick)
	defer t.Stop()
	s.runOnce(ctx) // 启动即跑一轮
	for {
		select {
		case <-ctx.Done():
			slog.Info("collect scheduler stopped")
			return
		case <-t.C:
			s.runOnce(ctx)
		}
	}
}

func (s *Scheduler) runOnce(ctx context.Context) {
	var due []model.Source
	s.db.WithContext(ctx).
		Where("enabled = true").
		Where("last_sync_at IS NULL OR last_sync_at < now() - (sync_interval_min * interval '1 minute')").
		Find(&due)
	if len(due) == 0 {
		return
	}
	slog.Info("scheduler: sources due", "count", len(due))
	sem := make(chan struct{}, s.concurrency)
	for i := range due {
		select {
		case <-ctx.Done():
			return
		case sem <- struct{}{}:
		}
		go func(src model.Source) {
			defer func() { <-sem }()
			if _, err := s.syncer.SyncSource(ctx, &src, false); err != nil {
				slog.Error("scheduled sync failed", "source", src.Name, "err", err)
			}
		}(due[i])
	}
	// 等待本轮全部归还信号量
	for i := 0; i < s.concurrency; i++ {
		sem <- struct{}{}
	}
}
