-- 只采直链 m3u8：清掉历史遗留的非直链播放源（云播分享页 /share/.. 、解析线、mp4 等）。
-- 这些线路播放器播不了，且同源多 flag 会在前端显示成重复线路（如「u酷资源」出现两条）。
-- 判定：一条播放源没有任何一集 URL 含 .m3u8 → 整条删除（其 episodes 一并删）。
DELETE FROM episodes e
  WHERE NOT EXISTS (
    SELECT 1 FROM episodes m WHERE m.play_source_id = e.play_source_id AND m.url LIKE '%.m3u8%'
  );
DELETE FROM play_sources ps
  WHERE NOT EXISTS (
    SELECT 1 FROM episodes m WHERE m.play_source_id = ps.id AND m.url LIKE '%.m3u8%'
  );

-- 重算聚合（删源后 source_count/latest_episode 可能变小）。只改真正变化的行、不动 updated_at，
-- 否则全表刷新时间会污染「最新」排序与 sitemap 的 lastmod。
UPDATE titles t SET
  source_count   = sub.sc,
  latest_episode = sub.le
FROM (
  SELECT id,
    (SELECT count(DISTINCT source_id) FROM play_sources WHERE title_id = titles.id) AS sc,
    COALESCE((SELECT max(episode_count) FROM play_sources WHERE title_id = titles.id), 0) AS le
  FROM titles
) sub
WHERE t.id = sub.id AND (t.source_count <> sub.sc OR t.latest_episode <> sub.le);
