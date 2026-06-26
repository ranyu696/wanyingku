import { Suspense } from "react";
import { Box, Typography } from "@mui/material";
import type { Metadata } from "next";
import { connection } from "next/server";
import { getHome } from "@/lib/cached";
import { websiteLd } from "@/lib/seo";
import { DEF_TITLE, ogBase, SITE_URL } from "@/lib/site";
import Collections from "@/components/Collections";
import HeroCarousel from "@/components/HeroCarousel";
import HomeContinue from "@/components/HomeContinue";
import InfiniteRow from "@/components/InfiniteRow";
import RandomPick from "@/components/RandomPick";
import RecommendRow from "@/components/RecommendRow";
import { HomeSkeleton } from "@/components/State";

// 首页 canonical / og:url（"/" 规范化到站点根，避免带参/分页重复收录）
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  // 注意：Next 对 openGraph 是浅合并(整体替换)，必须 spread ogBase，否则会顶掉 siteName/locale 等
  openGraph: { ...ogBase, url: SITE_URL },
};

// 首页正文 SSR：服务端取 /home（含 banners + 各分类 sections），渲染出带影片的 HTML。
// 各分类横排用 InfiniteRow：首屏 SSR 出影片(SEO)，向右滑到头按 sort 翻页无限加载。
// 按请求渲染：构建期无 API 会预渲染空首页，故不走静态预渲染。

// 首页正文：connection() 强制请求期渲染——否则 cacheComponents(PPR) 会把构建期(API 不可达)
// 取到的空 sections 烤进静态壳，首屏只剩客户端组件(专题)，分类横排要导航一圈才出现。
async function HomeBody() {
  await connection();
  const data = await getHome();
  const banners = data?.banners ?? [];
  const sections = data?.sections ?? [];
  return (
    <>
      <HeroCarousel items={banners} />
      <RandomPick />
      <HomeContinue />
      <RecommendRow />
      <Collections />
      {sections.map((s) => (
        <InfiniteRow key={`${s.kind}-${s.title}`} title={s.title} kind={s.kind} sort={s.sort} initial={s.list} />
      ))}
    </>
  );
}

export default function HomePage() {
  const ld = websiteLd(SITE_URL);
  return (
    <Box sx={{ pb: 2 }}>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }}
      />
      {/* 页面唯一 H1：对屏幕阅读器/搜索引擎可见，视觉上隐藏以不破坏 hero 布局 */}
      <Typography component="h1" sx={{ position: "absolute", width: 1, height: 1, p: 0, m: -1, overflow: "hidden", clip: "rect(0 0 0 0)", whiteSpace: "nowrap", border: 0 }}>
        {DEF_TITLE}
      </Typography>
      {/* 静态壳秒发 H1/骨架，正文请求期流式补入(数据来自 cacheLife("minutes") 仍很快) */}
      <Suspense fallback={<HomeSkeleton />}>
        <HomeBody />
      </Suspense>
    </Box>
  );
}
