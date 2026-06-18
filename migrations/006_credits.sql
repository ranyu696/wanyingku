-- 作品补充：导演 / 主演 / 地区
ALTER TABLE titles ADD COLUMN IF NOT EXISTS director TEXT;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS actors TEXT;
ALTER TABLE titles ADD COLUMN IF NOT EXISTS area TEXT;
CREATE INDEX IF NOT EXISTS idx_titles_area ON titles (area);

-- 从采集源回填（每个作品取其一条采集记录的 导演/主演/地区）
UPDATE titles t SET
  director = si.director,
  actors   = si.actors,
  area     = si.area
FROM (
  SELECT DISTINCT ON (title_id) title_id, director, actors, area
  FROM source_items WHERE title_id IS NOT NULL
  ORDER BY title_id, id
) si
WHERE si.title_id = t.id
  AND (t.director IS NULL OR t.director = '');
