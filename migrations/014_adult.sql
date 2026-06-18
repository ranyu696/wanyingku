-- 成人内容标记（伦理片/里番等）。仍按 kind 归入 电影/动漫，但前端海报默认打码不直显。
ALTER TABLE titles ADD COLUMN IF NOT EXISTS adult boolean NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_titles_adult ON titles(adult) WHERE adult;
