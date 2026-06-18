-- 影视聚合 · 核心表结构 (PostgreSQL 16+)
-- schema 唯一来源；GORM 仅做查询层，不做 AutoMigrate。
-- 设计核心：1 个规范作品(titles) ←→ N 个播放源(play_sources, 按 采集源+语种/版本) ←→ N 个剧集(episodes)
--          不同采集源的同一部片，通过 TMDB id / 归一化标题 / 模糊相似 解析到同一个 title_id 实现合并。

BEGIN;

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- 三元组模糊匹配（去重兜底）
CREATE EXTENSION IF NOT EXISTS unaccent;  -- 去重音，辅助归一化

-- ---------------------------------------------------------------------------
-- 分类 & 题材
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id        SERIAL PRIMARY KEY,
    parent_id INT,
    name      TEXT NOT NULL,
    slug      TEXT UNIQUE NOT NULL,
    kind      SMALLINT NOT NULL DEFAULT 1,  -- 1电影 2电视剧 3综艺 4动漫 5纪录片 6短剧
    sort      INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS genres (
    id      INT PRIMARY KEY,               -- 复用 TMDB genre id
    name    TEXT NOT NULL,
    name_en TEXT
);

-- ---------------------------------------------------------------------------
-- 规范作品（去重归类的目标实体）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS titles (
    id              BIGSERIAL PRIMARY KEY,
    kind            SMALLINT NOT NULL DEFAULT 1,   -- 1电影 2电视剧 3综艺 4动漫 5纪录片 6短剧
    tmdb_id         INT,                           -- 命中 TMDB 时的聚类主键
    imdb_id         TEXT,
    douban_id       TEXT,
    name            TEXT NOT NULL,                 -- 规范中文名
    original_name   TEXT,                          -- 原始语言名
    norm_title      TEXT NOT NULL DEFAULT '',      -- 归一化标题（去语种/年份/季集标记），用于匹配
    sort_title      TEXT,                          -- 排序用
    year            INT,
    release_date    DATE,
    overview        TEXT,
    tagline         TEXT,
    poster          TEXT,
    backdrop        TEXT,
    genre_ids       INT[]  NOT NULL DEFAULT '{}',
    country         TEXT[] NOT NULL DEFAULT '{}',
    languages       TEXT[] NOT NULL DEFAULT '{}',
    runtime         INT,
    vote_average    REAL   NOT NULL DEFAULT 0,
    vote_count      INT    NOT NULL DEFAULT 0,
    popularity      REAL   NOT NULL DEFAULT 0,
    status          SMALLINT NOT NULL DEFAULT 1,   -- 1可见 0隐藏
    match_status    SMALLINT NOT NULL DEFAULT 0,   -- 0未匹配 1TMDB命中 2模糊命中 3向量命中 4LLM确认 5人工
    match_confidence REAL  NOT NULL DEFAULT 0,
    total_episodes  INT    NOT NULL DEFAULT 0,     -- 电视剧总集数（已知）
    latest_episode  INT    NOT NULL DEFAULT 0,     -- 已采集到的最高集（订阅更新判断）
    serial_complete BOOLEAN NOT NULL DEFAULT FALSE,
    source_count    INT    NOT NULL DEFAULT 0,     -- 关联的播放源数量
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- TMDB id 在同类型下唯一（命中后天然合并）
CREATE UNIQUE INDEX IF NOT EXISTS uq_titles_tmdb ON titles (tmdb_id, kind) WHERE tmdb_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_titles_norm_trgm ON titles USING gin (norm_title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_titles_name_trgm ON titles USING gin (name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_titles_kind_year ON titles (kind, year);
CREATE INDEX IF NOT EXISTS idx_titles_popularity ON titles (popularity DESC);
CREATE INDEX IF NOT EXISTS idx_titles_updated ON titles (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_titles_genres ON titles USING gin (genre_ids);

-- 所有已知别名/译名 → 匹配 + 搜索召回
CREATE TABLE IF NOT EXISTS title_aliases (
    id         BIGSERIAL PRIMARY KEY,
    title_id   BIGINT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    alias      TEXT NOT NULL,
    norm_alias TEXT NOT NULL,
    lang       TEXT,
    source     SMALLINT NOT NULL DEFAULT 2,  -- 1TMDB 2采集源 3人工
    UNIQUE (title_id, norm_alias)
);
CREATE INDEX IF NOT EXISTS idx_alias_norm_trgm ON title_aliases USING gin (norm_alias gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 采集源
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sources (
    id                 SERIAL PRIMARY KEY,
    name               TEXT NOT NULL,
    api_url            TEXT NOT NULL,          -- 苹果CMS 采集接口基址
    api_type           SMALLINT NOT NULL DEFAULT 1, -- 1 json 2 xml
    enabled            BOOLEAN NOT NULL DEFAULT TRUE,
    weight             INT NOT NULL DEFAULT 0, -- 播放源排序优先级（越大越靠前）
    sync_interval_min  INT NOT NULL DEFAULT 720,
    last_sync_at       TIMESTAMPTZ,
    last_full_sync_at  TIMESTAMPTZ,
    request_header     JSONB,
    note               TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 采集到的原始记录（审计 + 可重新归类）
CREATE TABLE IF NOT EXISTS source_items (
    id               BIGSERIAL PRIMARY KEY,
    source_id        INT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    vod_id           TEXT NOT NULL,          -- 源自身的 vod id
    type_id          INT,
    type_name        TEXT,
    name             TEXT NOT NULL,
    sub_name         TEXT,
    en_name          TEXT,
    year             INT,
    area             TEXT,
    lang             TEXT,
    remarks          TEXT,                   -- 更新至xx集 / HD / 完结
    actors           TEXT,
    director         TEXT,
    content          TEXT,
    pic              TEXT,
    play_from        TEXT,                   -- vod_play_from ($$$ 分隔)
    play_url         TEXT,                   -- vod_play_url ($$$ / # / $)
    raw              JSONB,
    title_id         BIGINT REFERENCES titles(id) ON DELETE SET NULL,
    match_method     SMALLINT NOT NULL DEFAULT 0,
    match_confidence REAL NOT NULL DEFAULT 0,
    needs_review     BOOLEAN NOT NULL DEFAULT FALSE,  -- 灰区/未匹配，待人工
    vod_time         TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (source_id, vod_id)
);
CREATE INDEX IF NOT EXISTS idx_source_items_title ON source_items (title_id);
CREATE INDEX IF NOT EXISTS idx_source_items_review ON source_items (needs_review) WHERE needs_review;
CREATE INDEX IF NOT EXISTS idx_source_items_name_trgm ON source_items USING gin (name gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 播放源 & 剧集（合并后的播放结构）
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS play_sources (
    id             BIGSERIAL PRIMARY KEY,
    title_id       BIGINT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    source_id      INT NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    source_item_id BIGINT REFERENCES source_items(id) ON DELETE SET NULL,
    flag           TEXT NOT NULL DEFAULT '',  -- vod_play_from（如 m3u8 / 国语 / 粤语）
    lang           TEXT,                      -- 归一化后的语种/版本
    quality        TEXT,
    episode_count  INT NOT NULL DEFAULT 0,
    weight         INT NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (title_id, source_id, flag)
);
CREATE INDEX IF NOT EXISTS idx_play_sources_title ON play_sources (title_id);

CREATE TABLE IF NOT EXISTS episodes (
    id             BIGSERIAL PRIMARY KEY,
    play_source_id BIGINT NOT NULL REFERENCES play_sources(id) ON DELETE CASCADE,
    title_id       BIGINT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    idx            INT NOT NULL DEFAULT 0,    -- 集序号（电影为 0/1）
    name           TEXT NOT NULL,             -- 第01集 / 正片 / HD
    url            TEXT NOT NULL,             -- 播放地址（m3u8 等）
    UNIQUE (play_source_id, idx)
);
CREATE INDEX IF NOT EXISTS idx_episodes_title ON episodes (title_id);

-- ---------------------------------------------------------------------------
-- 用户 & 用户数据
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            BIGSERIAL PRIMARY KEY,
    username      TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    nickname      TEXT,
    avatar        TEXT,
    role          SMALLINT NOT NULL DEFAULT 0,  -- 0普通 1管理员
    status        SMALLINT NOT NULL DEFAULT 1,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS favorites (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_id   BIGINT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, title_id)
);

CREATE TABLE IF NOT EXISTS watch_history (
    id             BIGSERIAL PRIMARY KEY,
    user_id        BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_id       BIGINT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    play_source_id BIGINT,
    episode_id     BIGINT,
    episode_idx    INT NOT NULL DEFAULT 0,
    position       INT NOT NULL DEFAULT 0,   -- 播放进度（秒）
    duration       INT NOT NULL DEFAULT 0,
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, title_id)
);
CREATE INDEX IF NOT EXISTS idx_history_user ON watch_history (user_id, updated_at DESC);

-- 订阅更新（电视剧/综艺追更）
CREATE TABLE IF NOT EXISTS subscriptions (
    id                     BIGSERIAL PRIMARY KEY,
    user_id                BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title_id               BIGINT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    last_notified_episode  INT NOT NULL DEFAULT 0,
    created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, title_id)
);
CREATE INDEX IF NOT EXISTS idx_subs_title ON subscriptions (title_id);

-- 求片
CREATE TABLE IF NOT EXISTS requests (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT REFERENCES users(id) ON DELETE SET NULL,
    name       TEXT NOT NULL,
    year       INT,
    kind       SMALLINT NOT NULL DEFAULT 0,
    note       TEXT,
    status     SMALLINT NOT NULL DEFAULT 0,  -- 0待处理 1处理中 2已满足 3已拒绝
    title_id   BIGINT REFERENCES titles(id) ON DELETE SET NULL,
    vote_count INT NOT NULL DEFAULT 1,       -- 同求人数
    admin_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_requests_status ON requests (status, vote_count DESC);

-- 同一个人对同名同年的请求去重（用于"同求+1"）
CREATE UNIQUE INDEX IF NOT EXISTS uq_request_user_name
    ON requests (user_id, lower(name), COALESCE(year, 0)) WHERE user_id IS NOT NULL;

-- 站内通知（订阅更新到 / 求片满足）
CREATE TABLE IF NOT EXISTS notifications (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind       SMALLINT NOT NULL DEFAULT 0,  -- 1订阅更新 2求片满足 3系统
    title      TEXT NOT NULL,
    body       TEXT,
    ref_id     BIGINT,
    is_read    BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications (user_id, is_read, created_at DESC);

COMMIT;
