-- 可选：pgvector 向量层（去重引擎第三层「向量召回」）
-- 前置：brew install pgvector  然后  make migrate-vector
-- 维度需与 ai.embedding_model 一致：text-embedding-3-small=1536, bge-m3=1024。
-- 改维度时同步修改 config.yaml 的 ai.embedding_dim 与下方 vector(1536)。

BEGIN;

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS title_embeddings (
    title_id   BIGINT PRIMARY KEY REFERENCES titles(id) ON DELETE CASCADE,
    model      TEXT NOT NULL,
    embedding  vector(1536) NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 余弦相似度近邻索引（数据量上来后可调 lists / 改 hnsw）
CREATE INDEX IF NOT EXISTS idx_title_emb_cos
    ON title_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

COMMIT;
