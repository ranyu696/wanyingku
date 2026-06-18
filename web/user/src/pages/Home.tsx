import { Box } from "@mui/material";
import { useHistory, useHome } from "../api/hooks";
import Collections from "../components/Collections";
import ContinueWatching from "../components/ContinueWatching";
import HeroCarousel from "../components/HeroCarousel";
import HotRow from "../components/HotRow";
import RandomPick from "../components/RandomPick";
import RecommendRow from "../components/RecommendRow";
import { HomeSkeleton } from "../components/State";
import { useAuth } from "../store/auth";
import { useSeo } from "../seo";

// 首页横排：每排按分类独立分页，侧滑到右端自动加载更多
const ROWS: Array<{ title: string; kind: number }> = [
  { title: "热门电影", kind: 1 },
  { title: "热门剧集", kind: 2 },
  { title: "热门动漫", kind: 4 },
  { title: "热门综艺", kind: 3 },
  { title: "热门短剧", kind: 6 },
  { title: "纪录片", kind: 5 },
];

export default function Home() {
  const { token } = useAuth();
  const hist = useHistory(Boolean(token));
  const { data, loading } = useHome();
  useSeo(); // 首页用站点默认标题/描述
  const banners = data?.banners ?? [];
  const sections = data?.sections ?? [];
  if (loading && sections.length === 0 && banners.length === 0) {
    return <HomeSkeleton />;
  }
  return (
    <Box sx={{ pb: 2 }}>
      <HeroCarousel items={banners} />
      <RandomPick />
      <ContinueWatching items={hist.data?.list ?? []} />
      <RecommendRow />
      <Collections />
      {ROWS.map((r) => (
        <HotRow key={r.kind} title={r.title} kind={r.kind} />
      ))}
    </Box>
  );
}
