-- 豆瓣增强：评分/票数（douban_id 列已在 001 建好）。可重复执行。
ALTER TABLE titles ADD COLUMN IF NOT EXISTS douban_rating REAL NOT NULL DEFAULT 0;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS douban_votes  INT  NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_titles_douban ON titles (douban_rating DESC) WHERE douban_rating > 0;
