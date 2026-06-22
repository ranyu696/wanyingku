package config

import (
	"fmt"
	"os"
	"strconv"

	"gopkg.in/yaml.v3"
)

type Config struct {
	App      App      `yaml:"app"`
	Database Database `yaml:"database"`
	Redis    Redis    `yaml:"redis"`
	Meili    Meili    `yaml:"meilisearch"`
	TMDB     TMDB     `yaml:"tmdb"`
	AI       AI       `yaml:"ai"`
	Resolve  Resolve  `yaml:"resolve"`
	Collect  Collect  `yaml:"collect"`
	Storage  Storage  `yaml:"storage"`
	Push     Push     `yaml:"push"`
}

// Push Firebase Cloud Messaging（站内通知同时推送到设备）。
type Push struct {
	Enabled         bool   `yaml:"enabled"`
	CredentialsFile string `yaml:"credentials_file"` // Firebase Admin SDK 私钥 JSON 路径（务必 gitignore）
}

// Storage 图床/对象存储（S3 兼容）。
type Storage struct {
	Enabled       bool   `yaml:"enabled"`
	Endpoint      string `yaml:"endpoint"`
	Region        string `yaml:"region"`
	Bucket        string `yaml:"bucket"`
	AccessKey     string `yaml:"access_key"`
	SecretKey     string `yaml:"secret_key"`
	UseSSL        bool   `yaml:"use_ssl"`
	PublicBaseURL string `yaml:"public_base_url"`
	Prefix        string `yaml:"prefix"`
}

type App struct {
	Name           string `yaml:"name"`
	Env            string `yaml:"env"`
	Addr           string `yaml:"addr"`
	APIPrefix      string `yaml:"api_prefix"`
	Timezone       string `yaml:"timezone"`
	JWTSecret      string `yaml:"jwt_secret"`
	JWTExpireHours int    `yaml:"jwt_expire_hours"`
}

type Database struct {
	DSN     string `yaml:"dsn"`
	MaxOpen int    `yaml:"max_open"`
	MaxIdle int    `yaml:"max_idle"`
	LogSQL  bool   `yaml:"log_sql"`
}

type Redis struct {
	Addr        string `yaml:"addr"`
	Password    string `yaml:"password"`
	DB          int    `yaml:"db"`
	CacheTTLSec int    `yaml:"cache_ttl_sec"`
}

type Meili struct {
	Enabled bool   `yaml:"enabled"`
	Host    string `yaml:"host"`
	APIKey  string `yaml:"api_key"`
	Index   string `yaml:"index"`
}

type TMDB struct {
	Enabled   bool   `yaml:"enabled"`
	APIKey    string `yaml:"api_key"`
	BaseURL   string `yaml:"base_url"`
	ImageBase string `yaml:"image_base"`
	Language  string `yaml:"language"`
	Region    string `yaml:"region"`
	Proxy     string `yaml:"proxy"`
}

type AI struct {
	VectorEnabled     bool   `yaml:"vector_enabled"`
	LLMEnabled        bool   `yaml:"llm_enabled"`
	Provider          string `yaml:"provider"`
	BaseURL           string `yaml:"base_url"`
	APIKey            string `yaml:"api_key"`
	EmbeddingModel    string `yaml:"embedding_model"`
	EmbeddingDim      int    `yaml:"embedding_dim"`
	ChatModel         string `yaml:"chat_model"`
	RequestTimeoutSec int    `yaml:"request_timeout_sec"`
}

type Resolve struct {
	FuzzyThreshold     float64 `yaml:"fuzzy_threshold"`
	AutoMergeThreshold float64 `yaml:"auto_merge_threshold"`
	LLMReviewLow       float64 `yaml:"llm_review_low"`
	YearTolerance      int     `yaml:"year_tolerance"`
	EnableTMDB         bool    `yaml:"enable_tmdb"`
}

type Collect struct {
	Concurrency        int    `yaml:"concurrency"`
	RequestTimeoutSec  int    `yaml:"request_timeout_sec"`
	UserAgent          string `yaml:"user_agent"`
	DefaultIntervalMin int    `yaml:"default_interval_min"`
	SchedulerEnabled   bool   `yaml:"scheduler_enabled"`
	PageDelayMs        int    `yaml:"page_delay_ms"`        // 翻页请求间隔（限速，避免被封）
	MaxPages           int    `yaml:"max_pages"`            // 单源单次最大页数，0=默认上限
	ProbeIntervalHours int    `yaml:"probe_interval_hours"` // 播放源探活间隔（小时），0=关闭
}

// Load reads YAML config from path, applies env overrides and defaults.
func Load(path string) (*Config, error) {
	b, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read config %s: %w", path, err)
	}
	var c Config
	if err := yaml.Unmarshal(b, &c); err != nil {
		return nil, fmt.Errorf("parse config: %w", err)
	}
	c.applyDefaults()
	c.applyEnv()
	return &c, nil
}

func (c *Config) applyDefaults() {
	if c.App.Addr == "" {
		c.App.Addr = ":8080"
	}
	if c.App.APIPrefix == "" {
		c.App.APIPrefix = "/api/v1"
	}
	if c.App.Timezone == "" {
		c.App.Timezone = "Asia/Shanghai"
	}
	if c.App.JWTExpireHours == 0 {
		c.App.JWTExpireHours = 168
	}
	if c.Database.MaxOpen == 0 {
		c.Database.MaxOpen = 50
	}
	if c.Database.MaxIdle == 0 {
		c.Database.MaxIdle = 10
	}
	if c.Redis.CacheTTLSec == 0 {
		c.Redis.CacheTTLSec = 600
	}
	if c.Meili.Index == "" {
		c.Meili.Index = "titles"
	}
	if c.TMDB.BaseURL == "" {
		c.TMDB.BaseURL = "https://api.themoviedb.org/3"
	}
	if c.TMDB.ImageBase == "" {
		c.TMDB.ImageBase = "https://image.tmdb.org/t/p"
	}
	if c.TMDB.Language == "" {
		c.TMDB.Language = "zh-CN"
	}
	if c.AI.BaseURL == "" {
		c.AI.BaseURL = "https://api.openai.com/v1"
	}
	if c.AI.EmbeddingModel == "" {
		c.AI.EmbeddingModel = "text-embedding-3-small"
	}
	if c.AI.EmbeddingDim == 0 {
		c.AI.EmbeddingDim = 1536
	}
	if c.AI.ChatModel == "" {
		c.AI.ChatModel = "gpt-4o-mini"
	}
	if c.AI.RequestTimeoutSec == 0 {
		c.AI.RequestTimeoutSec = 30
	}
	if c.Resolve.FuzzyThreshold == 0 {
		c.Resolve.FuzzyThreshold = 0.42
	}
	if c.Resolve.AutoMergeThreshold == 0 {
		c.Resolve.AutoMergeThreshold = 0.86
	}
	if c.Resolve.LLMReviewLow == 0 {
		c.Resolve.LLMReviewLow = 0.62
	}
	if c.Resolve.YearTolerance == 0 {
		c.Resolve.YearTolerance = 1
	}
	if c.Collect.Concurrency == 0 {
		c.Collect.Concurrency = 3
	}
	if c.Collect.RequestTimeoutSec == 0 {
		c.Collect.RequestTimeoutSec = 20
	}
	if c.Collect.UserAgent == "" {
		c.Collect.UserAgent = "Mozilla/5.0 (yinshi-collector)"
	}
	if c.Collect.DefaultIntervalMin == 0 {
		c.Collect.DefaultIntervalMin = 720
	}
	if c.Collect.PageDelayMs == 0 {
		c.Collect.PageDelayMs = 800
	}
}

// applyEnv lets a few sensitive values come from environment variables.
func (c *Config) applyEnv() {
	if v := os.Getenv("YINSHI_DB_DSN"); v != "" {
		c.Database.DSN = v
	}
	if v := os.Getenv("YINSHI_JWT_SECRET"); v != "" {
		c.App.JWTSecret = v
	}
	if v := os.Getenv("TMDB_API_KEY"); v != "" {
		c.TMDB.APIKey = v
	}
	if v := os.Getenv("AI_API_KEY"); v != "" {
		c.AI.APIKey = v
	}
	// Redis：容器化部署常用环境变量注入（如 Railway 通过引用变量提供 host/port/password）。
	if v := os.Getenv("YINSHI_REDIS_ADDR"); v != "" {
		c.Redis.Addr = v
	}
	if v := os.Getenv("YINSHI_REDIS_PASSWORD"); v != "" {
		c.Redis.Password = v
	}
	if v := os.Getenv("YINSHI_REDIS_DB"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			c.Redis.DB = n
		}
	}
	// Meilisearch：容器化部署时通过环境变量接入（未配置则沿用 YAML 设置）。
	if v := os.Getenv("YINSHI_MEILI_HOST"); v != "" {
		c.Meili.Host = v
	}
	if v := os.Getenv("YINSHI_MEILI_API_KEY"); v != "" {
		c.Meili.APIKey = v
	}
	if v := os.Getenv("YINSHI_MEILI_ENABLED"); v != "" {
		c.Meili.Enabled = v == "true" || v == "1"
	}
	// PORT：平台动态端口（Railway/Heroku 等），覆盖监听地址。
	if v := os.Getenv("PORT"); v != "" {
		c.App.Addr = ":" + v
	}
}

func (c *Config) IsProd() bool { return c.App.Env == "prod" }
