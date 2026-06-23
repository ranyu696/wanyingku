import { Box, Stack, Typography } from "@mui/material";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { serverGetSafe } from "@/lib/api";
import type { HomeData, HomeSection } from "@/lib/types";
import Collections from "@/components/Collections";
import HeroCarousel from "@/components/HeroCarousel";
import HomeContinue from "@/components/HomeContinue";
import PosterCard from "@/components/PosterCard";
import RandomPick from "@/components/RandomPick";
import RecommendRow from "@/components/RecommendRow";

// 首页正文 SSR：服务端取 /home（含 banners + 各分类 sections），渲染出带影片的 HTML。
// 按请求渲染：构建期无 API 会预渲染空首页，故不走静态预渲染。ponytail: 需要缓存时再上 unstable_cache/revalidate
export const dynamic = "force-dynamic";

// 横排分类：服务端渲染（数据来自首页 /home sections）。「更多」跳分类页深链。
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
        <Link href={`/category?kind=${s.kind}`} style={{ textDecoration: "none", color: "inherit" }}>
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

export default async function HomePage() {
  const data = await serverGetSafe<HomeData>("/home");
  const banners = data?.banners ?? [];
  const sections = data?.sections ?? [];
  return (
    <Box sx={{ pb: 2 }}>
      <HeroCarousel items={banners} />
      <RandomPick />
      <HomeContinue />
      <RecommendRow />
      <Collections />
      {sections.map((s) => (
        <SectionRow key={`${s.kind}-${s.title}`} s={s} />
      ))}
    </Box>
  );
}
