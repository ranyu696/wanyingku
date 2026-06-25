-- 只采直链 m3u8：清掉历史遗留的非直链播放源（云播分享页 /share/.. 、解析线、mp4 等）。
-- 这些线路播放器播不了，且同源多 flag 会在前端显示成重复线路（如「u酷资源」出现两条）。
-- 判定：一条播放源没有任何一集 URL 含 .m3u8 → 整条删除（其 episodes 一并删）。
BEGIN;

-- 先一次性算出要删的播放源（避免逐行 correlated 子查询，episodes 百万级会很慢）
CREATE TEMP TABLE _bad_ps AS
  SELECT ps.id, ps.title_id FROM play_sources ps
  WHERE NOT EXISTS (
    SELECT 1 FROM episodes e WHERE e.play_source_id = ps.id AND e.url LIKE '%.m3u8%'
  );

DELETE FROM episodes     WHERE play_source_id IN (SELECT id FROM _bad_ps);
DELETE FROM play_sources WHERE id             IN (SELECT id FROM _bad_ps);

-- 只重算受影响作品的聚合（不动 updated_at，避免污染「最新」排序与 sitemap lastmod）
UPDATE titles t SET
  source_count   = (SELECT count(DISTINCT source_id) FROM play_sources WHERE title_id = t.id),
  latest_episode = COALESCE((SELECT max(episode_count) FROM play_sources WHERE title_id = t.id), 0)
WHERE t.id IN (SELECT DISTINCT title_id FROM _bad_ps);

DROP TABLE _bad_ps;
COMMIT;
