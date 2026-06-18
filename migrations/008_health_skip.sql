-- 死链检测/播放源优选 + 众包片头片尾打点。可重复执行。

-- 播放源健康度：health 1=正常 0=未知 -1=死链（DESC 排序天然把死链沉底）
ALTER TABLE play_sources ADD COLUMN IF NOT EXISTS health           SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE play_sources ADD COLUMN IF NOT EXISTS latency_ms       INT      NOT NULL DEFAULT 0;
ALTER TABLE play_sources ADD COLUMN IF NOT EXISTS last_checked_at  TIMESTAMPTZ;
ALTER TABLE play_sources ADD COLUMN IF NOT EXISTS fail_count       INT      NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_play_sources_health ON play_sources (title_id, health DESC, weight DESC);

-- 众包片头片尾打点：每季已是独立 title，故按 title_id 聚合；存每次提交，读取时取中位数去噪
CREATE TABLE IF NOT EXISTS skip_markers (
    id          BIGSERIAL PRIMARY KEY,
    title_id    BIGINT NOT NULL REFERENCES titles(id) ON DELETE CASCADE,
    user_id     BIGINT REFERENCES users(id) ON DELETE SET NULL,
    intro_end   INT NOT NULL DEFAULT 0,   -- 片头结束秒（0=未标）
    outro_start INT NOT NULL DEFAULT 0,   -- 片尾开始秒（0=未标）
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_skip_markers_title ON skip_markers (title_id);
-- 同一用户对同一作品只留一条（再次提交即更新）
CREATE UNIQUE INDEX IF NOT EXISTS uq_skip_user ON skip_markers (title_id, user_id) WHERE user_id IS NOT NULL;
