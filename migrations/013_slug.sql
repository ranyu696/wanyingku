-- 片名拼音 slug：URL 友好标识（/title/diqiuren-taixiongmengle）。空串表示尚未生成，前端回退数字 id。可重复执行。
ALTER TABLE titles ADD COLUMN IF NOT EXISTS slug TEXT NOT NULL DEFAULT '';
-- 唯一索引只约束非空 slug，允许多个空串
CREATE UNIQUE INDEX IF NOT EXISTS idx_titles_slug ON titles (slug) WHERE slug <> '';
