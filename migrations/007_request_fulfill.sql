-- 求片闭环：显式投票（顶片）去重 + 采集自动满足用的归一片名
-- 与 001 的 requests 表配套；可重复执行。

-- 谁投过票（防重复、可取消、前端 is_voted）；登录用户才记
CREATE TABLE IF NOT EXISTS request_votes (
    request_id BIGINT NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
    user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (request_id, user_id)
);

-- 归一片名：与 titles.norm_title 同一套 textutil.Normalize，采集时按它匹配待处理求片
ALTER TABLE requests ADD COLUMN IF NOT EXISTS norm_name TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS idx_requests_norm ON requests (norm_name) WHERE status IN (0, 1);
