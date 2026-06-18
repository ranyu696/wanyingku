-- 热搜榜：每个关键词一行，搜索时累加计数。可重复执行。
CREATE TABLE IF NOT EXISTS search_terms (
    keyword TEXT PRIMARY KEY,
    count   INT NOT NULL DEFAULT 0,
    last_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 取热搜：按计数排序，且 30 天内有人搜过（让过气词自然掉出）
CREATE INDEX IF NOT EXISTS idx_search_terms_hot ON search_terms (last_at, count DESC);
