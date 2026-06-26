// Package app 负责装配所有组件，供 server 与 worker 共用。
package app

import (
	"context"
	"time"

	"github.com/xiaoxin/cms/internal/cache"
	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/db"
	"github.com/xiaoxin/cms/internal/handler"
	"github.com/xiaoxin/cms/internal/repository"
	"github.com/xiaoxin/cms/internal/service/auth"
	"github.com/xiaoxin/cms/internal/service/collect"
	"github.com/xiaoxin/cms/internal/service/push"
	"github.com/xiaoxin/cms/internal/service/request"
	"github.com/xiaoxin/cms/internal/service/resolve"
	"github.com/xiaoxin/cms/internal/service/search"
	"github.com/xiaoxin/cms/internal/service/title"
	"github.com/xiaoxin/cms/internal/service/userdata"
	"github.com/xiaoxin/cms/pkg/aiprovider"
	"github.com/xiaoxin/cms/pkg/storage"
	"github.com/xiaoxin/cms/pkg/tmdb"
	"gorm.io/gorm"
	"log/slog"
)

type App struct {
	Cfg       *config.Config
	DB        *gorm.DB
	Cache     *cache.Cache
	Search    *search.Service
	Syncer    *collect.Syncer
	Scheduler *collect.Scheduler
	Handler   *handler.Handler
}

func Build(cfg *config.Config) (*App, error) {
	gdb, err := db.Open(cfg)
	if err != nil {
		return nil, err
	}
	c, err := cache.New(cfg)
	if err != nil {
		return nil, err
	}

	se := search.New(cfg)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	se.EnsureIndex(ctx)
	cancel()

	var tmdbClient *tmdb.Client
	if cfg.TMDB.Enabled && cfg.TMDB.APIKey != "" {
		tmdbClient = tmdb.New(cfg.TMDB.APIKey, cfg.TMDB.BaseURL, cfg.TMDB.ImageBase,
			cfg.TMDB.Language, cfg.TMDB.Region, cfg.TMDB.Proxy, 15*time.Second)
	}

	var ai aiprovider.Provider = aiprovider.Noop{}
	if cfg.AI.APIKey != "" && (cfg.AI.VectorEnabled || cfg.AI.LLMEnabled) {
		ai = aiprovider.NewOpenAICompatible(aiprovider.Options{
			BaseURL: cfg.AI.BaseURL, APIKey: cfg.AI.APIKey,
			EmbeddingModel: cfg.AI.EmbeddingModel, EmbeddingDim: cfg.AI.EmbeddingDim,
			ChatModel: cfg.AI.ChatModel, VectorEnabled: cfg.AI.VectorEnabled, LLMEnabled: cfg.AI.LLMEnabled,
			Timeout: time.Duration(cfg.AI.RequestTimeoutSec) * time.Second,
		})
	}

	pushSvc, err := push.New(context.Background(), gdb, cfg.Push)
	if err != nil {
		slog.Warn("FCM 推送初始化失败，站内通知仍可用", "err", err)
	}

	store := BuildStorage(cfg)
	engine := resolve.New(gdb, tmdbClient, ai, cfg.Resolve, cfg.AI).WithStorage(store)
	mac := collect.NewMacCMSClient(time.Duration(cfg.Collect.RequestTimeoutSec)*time.Second, cfg.Collect.UserAgent)
	syncer := collect.NewSyncer(gdb, mac, engine, se, cfg.Collect, pushSvc)
	scheduler := collect.NewScheduler(gdb, syncer, cfg.Collect.Concurrency, cfg.Collect.UserAgent, cfg.Collect.ProbeIntervalHours)

	repo := repository.New(gdb)
	h := &handler.Handler{
		Cfg:    cfg,
		Title:  title.New(repo, c, se, ai),
		Auth:   auth.New(gdb, cfg.App.JWTSecret, cfg.App.JWTExpireHours),
		User:   userdata.New(gdb),
		Req:    request.New(gdb),
		Repo:   repo,
		Syncer: syncer,
		Push:   pushSvc,
		Store:  store,
		Cache:  c,
		DB:     gdb,
	}

	return &App{
		Cfg: cfg, DB: gdb, Cache: c, Search: se,
		Syncer: syncer, Scheduler: scheduler, Handler: h,
	}, nil
}

// BuildStorage 按配置构建图床（S3 兼容）；未启用或失败时返回 Noop。
func BuildStorage(cfg *config.Config) storage.Storage {
	if !cfg.Storage.Enabled || cfg.Storage.Bucket == "" {
		return storage.Noop{}
	}
	s3, err := storage.NewS3(storage.Options{
		Endpoint: cfg.Storage.Endpoint, Region: cfg.Storage.Region, Bucket: cfg.Storage.Bucket,
		AccessKey: cfg.Storage.AccessKey, SecretKey: cfg.Storage.SecretKey, UseSSL: cfg.Storage.UseSSL,
		PublicBaseURL: cfg.Storage.PublicBaseURL, Prefix: cfg.Storage.Prefix,
	})
	if err != nil {
		slog.Warn("图床初始化失败，回退为不转存", "err", err)
		return storage.Noop{}
	}
	return s3
}
