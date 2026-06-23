import { Box, Stack, Typography } from "@mui/material";
import { ChevronRight } from "lucide-react";
import { getRouteApi, Link } from "@tanstack/react-router";
import { useHistory } from "../api/hooks";
import Collections from "../components/Collections";
import ContinueWatching from "../components/ContinueWatching";
import HeroCarousel from "../components/HeroCarousel";
import PosterCard from "../components/PosterCard";
import RandomPick from "../components/RandomPick";
import RecommendRow from "../components/RecommendRow";
import { useAuth } from "../store/auth";
import { useSeo } from "../seo";
import type { HomeSection } from "../api/types";

const homeApi = getRouteApi("/");

// ponytail: 横排改为服务端渲染（数据来自首页 loader 的 /home sections），
// 取代原先 6 个 HotRow 各自客户端拉取 —— 同样内容、能 SSR、代码更少；
// 代价：失去侧滑无限加载（够多就够看，「更多」跳分类页）。
function SectionRow({ s }: { s: HomeSection }) {
  if (!s.list?.length) {
    return null;
  }
  return (
    <Box sx={{ mt: { xs: 2, md: 3 } }}>
      <Stack direction="row" sx={{ px: { xs: 1.5, md: 2 }, mb: 1, alignItems: "baseline" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, fontSize: { md: "1.15rem" } }}>
          {s.title}
        </Typography>
        <Link to="/category" search={{ kind: s.kind }} style={{ textDecoration: "none", color: "inherit" }}>
          <Stack
            direction="row"
            sx={{ alignItems: "center", color: "text.secondary", "&:hover": { color: "primary.main" } }}
          >
            <Typography variant="caption">更多</Typography>
            <ChevronRight size={14} />
          </Stack>
        </Link>
      </Stack>
      <Box
        sx={{
          display: "flex",
          gap: { xs: 1.2, md: 1.5 },
          overflowX: "auto",
          px: { xs: 1.5, md: 2 },
          pb: 1,
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {s.list.map((t) => (
          <Box key={t.id} sx={{ flex: "0 0 auto", width: { xs: 112, sm: 130, md: 150 } }}>
            <PosterCard t={t} />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function Home() {
  const { token } = useAuth();
  const hist = useHistory(Boolean(token));
  const data = homeApi.useLoaderData(); // SSR：首屏带 banners + 各分类影片
  useSeo(); // 首页用站点默认标题/描述
  const banners = data?.banners ?? [];
  const sections = data?.sections ?? [];
  return (
    <Box sx={{ pb: 2 }}>
      <HeroCarousel items={banners} />
      <RandomPick />
      <ContinueWatching items={hist.data?.list ?? []} />
      <RecommendRow />
      <Collections />
      {sections.map((s) => (
        <SectionRow key={`${s.kind}-${s.title}`} s={s} />
      ))}
    </Box>
  );
}
