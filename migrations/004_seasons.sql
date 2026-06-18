-- 季作为独立作品：同剧名+同季+同类型 跨源合并，不同季各自独立（各有封面），
-- 详情按 (norm_title, kind) 分组提供「季切换」。
ALTER TABLE titles ADD COLUMN IF NOT EXISTS season SMALLINT NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_titles_series ON titles (norm_title, kind, season);

-- TMDB tv 是剧集级（多季共享一个 tmdb_id），唯一键需加入 season
DROP INDEX IF EXISTS uq_titles_tmdb;
CREATE UNIQUE INDEX IF NOT EXISTS uq_titles_tmdb ON titles (tmdb_id, kind, season) WHERE tmdb_id IS NOT NULL;
