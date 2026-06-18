-- 图片 BlurHash/缩略哈希占位（前端先渲染模糊占位再加载真图）
ALTER TABLE titles ADD COLUMN IF NOT EXISTS poster_blurhash   TEXT;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS backdrop_blurhash TEXT;
