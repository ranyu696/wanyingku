// Package model holds GORM query-layer structs. Schema is owned by migrations/*.sql
// (no AutoMigrate). Column tags here must stay in sync with 001_init.sql.
package model

import (
	"time"

	"github.com/lib/pq"
)

// Kind 作品类型
const (
	KindMovie   = 1 // 电影
	KindTV      = 2 // 电视剧
	KindVariety = 3 // 综艺
	KindAnime   = 4 // 动漫
	KindDoc     = 5 // 纪录片
	KindShort   = 6 // 短剧
	KindSports  = 7 // 体育（赛事直播录像）
)

// MatchStatus 归类匹配状态
const (
	MatchNone   = 0 // 未匹配
	MatchTMDB   = 1 // TMDB 命中
	MatchFuzzy  = 2 // 模糊命中
	MatchVector = 3 // 向量命中
	MatchLLM    = 4 // LLM 确认
	MatchManual = 5 // 人工
)

// Alias source
const (
	AliasFromTMDB   = 1
	AliasFromSource = 2
	AliasFromManual = 3
	AliasFromDouban = 4
)

// Request status
const (
	ReqPending    = 0
	ReqProcessing = 1
	ReqDone       = 2
	ReqRejected   = 3
)

// Title 规范作品（去重归类的目标实体）
type Title struct {
	ID              int64          `gorm:"primaryKey" json:"id"`
	Kind            int16          `gorm:"column:kind" json:"kind"`
	TmdbID          *int           `gorm:"column:tmdb_id" json:"tmdb_id,omitempty"`
	ImdbID          string         `gorm:"column:imdb_id" json:"imdb_id,omitempty"`
	DoubanID        string         `gorm:"column:douban_id" json:"douban_id,omitempty"`
	Slug            string         `gorm:"column:slug" json:"slug,omitempty"`
	DoubanRating    float32        `gorm:"column:douban_rating" json:"douban_rating"`
	DoubanVotes     int            `gorm:"column:douban_votes" json:"douban_votes"`
	Name            string         `gorm:"column:name" json:"name"`
	OriginalName    string         `gorm:"column:original_name" json:"original_name,omitempty"`
	NormTitle       string         `gorm:"column:norm_title" json:"-"`
	SortTitle       string         `gorm:"column:sort_title" json:"-"`
	Season          int16          `gorm:"column:season" json:"season"`
	Year            int            `gorm:"column:year" json:"year"`
	ReleaseDate     *time.Time     `gorm:"column:release_date;type:date" json:"release_date,omitempty"`
	Overview        string         `gorm:"column:overview" json:"overview,omitempty"`
	Tagline         string         `gorm:"column:tagline" json:"tagline,omitempty"`
	Director        string         `gorm:"column:director" json:"director,omitempty"`
	Actors          string         `gorm:"column:actors" json:"actors,omitempty"`
	Area            string         `gorm:"column:area" json:"area,omitempty"`
	Poster           string        `gorm:"column:poster" json:"poster,omitempty"`
	PosterBlurhash   string        `gorm:"column:poster_blurhash" json:"poster_blurhash,omitempty"`
	Backdrop         string        `gorm:"column:backdrop" json:"backdrop,omitempty"`
	BackdropBlurhash string        `gorm:"column:backdrop_blurhash" json:"backdrop_blurhash,omitempty"`
	GenreIDs        pq.Int64Array  `gorm:"column:genre_ids;type:integer[]" json:"genre_ids"`
	Tags            pq.StringArray `gorm:"column:tags;type:text[]" json:"tags"`
	Country         pq.StringArray `gorm:"column:country;type:text[]" json:"country"`
	Languages       pq.StringArray `gorm:"column:languages;type:text[]" json:"languages"`
	Runtime         int            `gorm:"column:runtime" json:"runtime,omitempty"`
	VoteAverage     float32        `gorm:"column:vote_average" json:"vote_average"`
	VoteCount       int            `gorm:"column:vote_count" json:"vote_count"`
	Popularity      float32        `gorm:"column:popularity" json:"popularity"`
	LikeCount       int            `gorm:"column:like_count" json:"like_count"`
	Status          int16          `gorm:"column:status" json:"status"`
	MatchStatus     int16          `gorm:"column:match_status" json:"match_status"`
	MatchConfidence float32        `gorm:"column:match_confidence" json:"match_confidence"`
	TotalEpisodes   int            `gorm:"column:total_episodes" json:"total_episodes"`
	LatestEpisode   int            `gorm:"column:latest_episode" json:"latest_episode"`
	SerialComplete  bool           `gorm:"column:serial_complete" json:"serial_complete"`
	Adult           bool           `gorm:"column:adult" json:"adult"` // 成人内容（伦理片/里番），前端海报打码
	SourceCount     int            `gorm:"column:source_count" json:"source_count"`
	CreatedAt       time.Time      `json:"created_at"`
	UpdatedAt       time.Time      `json:"updated_at"`
}

// TitleAlias 别名/译名
type TitleAlias struct {
	ID        int64  `gorm:"primaryKey" json:"id"`
	TitleID   int64  `gorm:"column:title_id" json:"title_id"`
	Alias     string `gorm:"column:alias" json:"alias"`
	NormAlias string `gorm:"column:norm_alias" json:"-"`
	Lang      string `gorm:"column:lang" json:"lang,omitempty"`
	Source    int16  `gorm:"column:source" json:"source"`
}

// Source 采集源
type Source struct {
	ID              int        `gorm:"primaryKey" json:"id"`
	Name            string     `gorm:"column:name" json:"name"`
	APIURL          string     `gorm:"column:api_url" json:"api_url"`
	APIType         int16      `gorm:"column:api_type" json:"api_type"`
	Enabled         bool       `gorm:"column:enabled" json:"enabled"`
	Weight          int        `gorm:"column:weight" json:"weight"`
	SyncIntervalMin int        `gorm:"column:sync_interval_min" json:"sync_interval_min"`
	LastSyncAt      *time.Time `gorm:"column:last_sync_at" json:"last_sync_at,omitempty"`
	LastFullSyncAt  *time.Time `gorm:"column:last_full_sync_at" json:"last_full_sync_at,omitempty"`
	RequestHeader   JSON       `gorm:"column:request_header;type:jsonb" json:"request_header,omitempty"`
	Note            string     `gorm:"column:note" json:"note,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// SourceItem 采集到的原始记录
type SourceItem struct {
	ID              int64      `gorm:"primaryKey" json:"id"`
	SourceID        int        `gorm:"column:source_id" json:"source_id"`
	VodID           string     `gorm:"column:vod_id" json:"vod_id"`
	TypeID          int        `gorm:"column:type_id" json:"type_id"`
	TypeName        string     `gorm:"column:type_name" json:"type_name"`
	Name            string     `gorm:"column:name" json:"name"`
	SubName         string     `gorm:"column:sub_name" json:"sub_name"`
	EnName          string     `gorm:"column:en_name" json:"en_name"`
	Year            int        `gorm:"column:year" json:"year"`
	Area            string     `gorm:"column:area" json:"area"`
	Lang            string     `gorm:"column:lang" json:"lang"`
	Remarks         string     `gorm:"column:remarks" json:"remarks"`
	Actors          string     `gorm:"column:actors" json:"actors"`
	Director        string     `gorm:"column:director" json:"director"`
	Content         string     `gorm:"column:content" json:"content"`
	Pic             string     `gorm:"column:pic" json:"pic"`
	PlayFrom        string     `gorm:"column:play_from" json:"play_from"`
	PlayURL         string     `gorm:"column:play_url" json:"play_url"`
	Raw             JSON       `gorm:"column:raw;type:jsonb" json:"-"`
	TitleID         *int64     `gorm:"column:title_id" json:"title_id,omitempty"`
	MatchMethod     int16      `gorm:"column:match_method" json:"match_method"`
	MatchConfidence float32    `gorm:"column:match_confidence" json:"match_confidence"`
	NeedsReview     bool       `gorm:"column:needs_review" json:"needs_review"`
	VodTime         *time.Time `gorm:"column:vod_time" json:"vod_time,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// PlaySource 播放源（title × source × flag）
type PlaySource struct {
	ID           int64     `gorm:"primaryKey" json:"id"`
	TitleID      int64     `gorm:"column:title_id" json:"title_id"`
	SourceID     int       `gorm:"column:source_id" json:"source_id"`
	SourceItemID *int64    `gorm:"column:source_item_id" json:"source_item_id,omitempty"`
	Flag         string    `gorm:"column:flag" json:"flag"`
	Lang         string    `gorm:"column:lang" json:"lang"`
	Quality      string    `gorm:"column:quality" json:"quality"`
	EpisodeCount int       `gorm:"column:episode_count" json:"episode_count"`
	Weight       int       `gorm:"column:weight" json:"weight"`
	Health       int16     `gorm:"column:health" json:"health"`             // 1正常 0未知 -1死链
	LatencyMs    int       `gorm:"column:latency_ms" json:"latency_ms"`     // 探活响应耗时
	LastCheckedAt *time.Time `gorm:"column:last_checked_at" json:"last_checked_at,omitempty"`
	FailCount    int       `gorm:"column:fail_count" json:"-"`
	UpdatedAt    time.Time `json:"updated_at"`

	Episodes []Episode `gorm:"foreignKey:PlaySourceID" json:"episodes,omitempty"`
	Source   *Source   `gorm:"foreignKey:SourceID" json:"source,omitempty"`
}

// Episode 剧集/播放单元
type Episode struct {
	ID           int64  `gorm:"primaryKey" json:"id"`
	PlaySourceID int64  `gorm:"column:play_source_id" json:"play_source_id"`
	TitleID      int64  `gorm:"column:title_id" json:"title_id"`
	Idx          int    `gorm:"column:idx" json:"idx"`
	Name         string `gorm:"column:name" json:"name"`
	URL          string `gorm:"column:url" json:"url"`
}

// Category 分类
type Category struct {
	ID       int    `gorm:"primaryKey" json:"id"`
	ParentID *int   `gorm:"column:parent_id" json:"parent_id,omitempty"`
	Name     string `gorm:"column:name" json:"name"`
	Slug     string `gorm:"column:slug" json:"slug"`
	Kind     int16  `gorm:"column:kind" json:"kind"`
	Sort     int    `gorm:"column:sort" json:"sort"`
}

// Genre 题材
type Genre struct {
	ID     int    `gorm:"primaryKey" json:"id"`
	Name   string `gorm:"column:name" json:"name"`
	NameEn string `gorm:"column:name_en" json:"name_en,omitempty"`
}

// User
type User struct {
	ID           int64     `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"column:username" json:"username"`
	PasswordHash string    `gorm:"column:password_hash" json:"-"`
	Nickname     string    `gorm:"column:nickname" json:"nickname"`
	Avatar       string    `gorm:"column:avatar" json:"avatar"`
	Role         int16     `gorm:"column:role" json:"role"`
	Status       int16     `gorm:"column:status" json:"status"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// Favorite 收藏
type Favorite struct {
	ID        int64     `gorm:"primaryKey" json:"id"`
	UserID    int64     `gorm:"column:user_id" json:"user_id"`
	TitleID   int64     `gorm:"column:title_id" json:"title_id"`
	CreatedAt time.Time `json:"created_at"`

	Title *Title `gorm:"foreignKey:TitleID" json:"title,omitempty"`
}

// WatchHistory 观看历史/进度
type WatchHistory struct {
	ID           int64     `gorm:"primaryKey" json:"id"`
	UserID       int64     `gorm:"column:user_id" json:"user_id"`
	TitleID      int64     `gorm:"column:title_id" json:"title_id"`
	PlaySourceID *int64    `gorm:"column:play_source_id" json:"play_source_id,omitempty"`
	EpisodeID    *int64    `gorm:"column:episode_id" json:"episode_id,omitempty"`
	EpisodeIdx   int       `gorm:"column:episode_idx" json:"episode_idx"`
	Position     int       `gorm:"column:position" json:"position"`
	Duration     int       `gorm:"column:duration" json:"duration"`
	UpdatedAt    time.Time `json:"updated_at"`

	Title *Title `gorm:"foreignKey:TitleID" json:"title,omitempty"`
}

func (WatchHistory) TableName() string { return "watch_history" }

// Subscription 订阅更新
type Subscription struct {
	ID                  int64     `gorm:"primaryKey" json:"id"`
	UserID              int64     `gorm:"column:user_id" json:"user_id"`
	TitleID             int64     `gorm:"column:title_id" json:"title_id"`
	LastNotifiedEpisode int       `gorm:"column:last_notified_episode" json:"last_notified_episode"`
	CreatedAt           time.Time `json:"created_at"`

	Title *Title `gorm:"foreignKey:TitleID" json:"title,omitempty"`
}

// Request 求片
type Request struct {
	ID        int64     `gorm:"primaryKey" json:"id"`
	UserID    *int64    `gorm:"column:user_id" json:"user_id,omitempty"`
	Name      string    `gorm:"column:name" json:"name"`
	Year      int       `gorm:"column:year" json:"year"`
	Kind      int16     `gorm:"column:kind" json:"kind"`
	Note      string    `gorm:"column:note" json:"note"`
	Status    int16     `gorm:"column:status" json:"status"`
	TitleID   *int64    `gorm:"column:title_id" json:"title_id,omitempty"`
	VoteCount int       `gorm:"column:vote_count" json:"vote_count"`
	NormName  string    `gorm:"column:norm_name" json:"-"`
	AdminNote string    `gorm:"column:admin_note" json:"admin_note,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Notification 站内通知
type Notification struct {
	ID        int64     `gorm:"primaryKey" json:"id"`
	UserID    int64     `gorm:"column:user_id" json:"user_id"`
	Kind      int16     `gorm:"column:kind" json:"kind"`
	Title     string    `gorm:"column:title" json:"title"`
	Body      string    `gorm:"column:body" json:"body"`
	RefID     *int64    `gorm:"column:ref_id" json:"ref_id,omitempty"`
	IsRead    bool      `gorm:"column:is_read" json:"is_read"`
	CreatedAt time.Time `json:"created_at"`
}

// DeviceToken 设备推送令牌（FCM）。一个用户可有多端。
type DeviceToken struct {
	ID        int64     `gorm:"primaryKey" json:"id"`
	UserID    int64     `gorm:"column:user_id" json:"user_id"`
	Token     string    `gorm:"column:token" json:"token"`
	Platform  string    `gorm:"column:platform" json:"platform"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Comment 影评/评论
type Comment struct {
	ID        int64     `gorm:"primaryKey" json:"id"`
	TitleID   int64     `gorm:"column:title_id" json:"title_id"`
	UserID    int64     `gorm:"column:user_id" json:"user_id"`
	Content   string    `gorm:"column:content" json:"content"`
	LikeCount int       `gorm:"column:like_count" json:"like_count"`
	CreatedAt time.Time `json:"created_at"`

	User    *User `gorm:"foreignKey:UserID" json:"user,omitempty"`
	IsLiked bool  `gorm:"-" json:"is_liked"`
}
