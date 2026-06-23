// Command server 启动 HTTP API（内置定时采集，可关闭）。
package main

import (
	"context"
	"flag"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/xiaoxin/cms/internal/app"
	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/router"
	"github.com/xiaoxin/cms/pkg/logger"
)

func main() {
	cfgPath := flag.String("config", "config.yaml", "配置文件路径")
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

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	if cfg.Collect.SchedulerEnabled {
		go application.Scheduler.Run(ctx)
	}
	// 探活独立于采集调度：采集可关，死链检测照常定时跑
	if cfg.Collect.ProbeIntervalHours > 0 {
		go application.Scheduler.RunProbe(ctx)
	}
	// 每日向 IndexNow 提交近期更新页（配了 key+site 才启）
	go application.Scheduler.RunIndexNow(ctx, os.Getenv("YINSHI_SITE_URL"), os.Getenv("YINSHI_INDEXNOW_KEY"))

	e := router.Setup(cfg, application.Handler)
	go func() {
		if err := e.Start(cfg.App.Addr); err != nil {
			slog.Info("http server closed", "reason", err)
		}
	}()
	slog.Info("server started", "addr", cfg.App.Addr, "prefix", cfg.App.APIPrefix)

	<-ctx.Done()
	slog.Info("shutting down...")
	shutCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	_ = e.Shutdown(shutCtx)
}
