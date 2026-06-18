-- 标签系统：从已采集的 vod_class 提取中文标签到 titles.tags。可重复执行。
ALTER TABLE titles ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_titles_tags ON titles USING gin (tags);

-- 一次性回填：从每个 title 关联的 source_items.raw->>'vod_class' 切分去重
UPDATE titles t SET tags = sub.tags
FROM (
    SELECT ps.title_id, array_agg(DISTINCT btrim(tag)) AS tags
    FROM play_sources ps
    JOIN source_items si ON si.id = ps.source_item_id
    CROSS JOIN LATERAL regexp_split_to_table(coalesce(si.raw->>'vod_class', ''), '[,，/、]') AS tag
    WHERE btrim(tag) <> ''
    GROUP BY ps.title_id
) sub
WHERE t.id = sub.title_id;
