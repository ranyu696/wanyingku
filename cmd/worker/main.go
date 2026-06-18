// Command worker 只跑采集调度（不开 HTTP），可与 server 分开部署。
// 也支持一次性手动采集：worker -once [-source <id>] [-full]
package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/xiaoxin/cms/internal/app"
	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/internal/service/collect"
	"github.com/xiaoxin/cms/internal/service/douban"
	"github.com/xiaoxin/cms/pkg/logger"
)

func main() {
	cfgPath := flag.String("config", "config.yaml", "配置文件路径")
	once := flag.Bool("once", false, "执行一次采集后退出")
	sourceID := flag.Int("source", 0, "仅采集指定源 id（配合 -once）")
	full := flag.Bool("full", false, "全量采集（否则增量）")
	probe := flag.Bool("probe", false, "探活播放源（死链检测）后退出")
	limit := flag.Int("limit", 0, "探活条数上限（0=全部，配合 -probe）")
	embed := flag.Bool("embed", false, "给全部作品补 AI 向量（语义搜索回填）后退出")
	dbn := flag.Bool("douban", false, "豆瓣增强（评分/id 回填，限流）后退出")
	slugFill := flag.Bool("slug", false, "给所有空 slug 的作品补拼音 slug 后退出")
	shortTags := flag.Bool("shorttags", false, "给全部短剧从片名抽取题材标签后退出")
	reclassify := flag.Bool("reclassify", false, "用各源分类树重算所有作品的 kind/adult 后退出")
	reindex := flag.Bool("reindex", false, "把全部作品重建进 Meilisearch 索引后退出")
	cleanHTML := flag.Bool("cleanhtml", false, "清洗历史简介里夹带的 HTML 标签后退出")
	delayMs := flag.Int("delay", 4000, "豆瓣增强请求间隔 ms（公共接口限流，建议 ≥4000）")
	flag.Parse()

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		panic(err)
	}
	logger.New(cfg.App.Env)

	application, err := app.Build(cfg)
	if err != nil {
		slog.Error("build app failed", "err", err)
		os.Exit(1)
	}

	if *probe {
		pr := collect.NewProber(application.DB, cfg.Collect.UserAgent, cfg.Collect.Concurrency)
		pr.ProbeAll(context.Background(), *limit)
		return
	}

	if *embed {
		n := application.Syncer.EmbedAll(context.Background())
		slog.Info("embed done", "count", n)
		return
	}

	if *slugFill {
		n := application.Syncer.BackfillSlugs(context.Background())
		slog.Info("slug backfill done", "filled", n)
		return
	}

	if *shortTags {
		n := application.Syncer.BackfillShortTags(context.Background())
		slog.Info("short drama retag done", "processed", n)
		return
	}

	if *reclassify {
		n := application.Syncer.ReclassifyAll(context.Background())
		slog.Info("reclassify done", "changed", n)
		return
	}

	if *reindex {
		n := application.Syncer.ReindexAll(context.Background())
		slog.Info("reindex done", "indexed", n)
		return
	}

	if *cleanHTML {
		n := application.Syncer.BackfillOverview(context.Background())
		slog.Info("overview html cleanup done", "cleaned", n)
		return
	}

	if *dbn {
		en := douban.NewEnricher(application.DB, cfg.Collect.UserAgent, *delayMs)
		en.EnrichMissing(context.Background(), *limit)
		return
	}

	if *once {
		ctx := context.Background()
		var srcs []model.Source
		q := application.DB.Where("enabled = true")
		if *sourceID > 0 {
			q = application.DB.Where("id = ?", *sourceID)
		}
		q.Find(&srcs)
		if len(srcs) == 0 {
			slog.Warn("没有可采集的源（先在管理后台或用 cmd/seed 添加）")
			return
		}
		for i := range srcs {
			stats, err := application.Syncer.SyncSource(ctx, &srcs[i], *full)
			if err != nil {
				slog.Error("sync failed", "source", srcs[i].Name, "err", err)
				continue
			}
			slog.Info("sync done", "source", srcs[i].Name, "stats", stats)
		}
		return
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if cfg.Collect.ProbeIntervalHours > 0 {
		go application.Scheduler.RunProbe(ctx)
	}
	application.Scheduler.Run(ctx)
}
