-- 设备推送令牌（FCM）。token 唯一：同一设备重装/换号时归属新用户。可重复执行。
CREATE TABLE IF NOT EXISTS device_tokens (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    token      TEXT   NOT NULL,
    platform   TEXT   NOT NULL DEFAULT 'android',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_device_tokens_token ON device_tokens (token);
CREATE INDEX IF NOT EXISTS idx_device_tokens_user ON device_tokens (user_id);
