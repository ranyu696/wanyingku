import type { Metadata } from "next";
import { Box, Typography } from "@mui/material";
import { serverGetSafe } from "@/lib/api";
import { BRAND } from "@/lib/site";
import { KIND_LABELS, type Genre, type Paged, type Title } from "@/lib/types";
import CategoryFilters from "@/components/CategoryFilters";
import Pager from "@/components/Pager";
import PosterGrid from "@/components/PosterGrid";
import { Empty } from "@/components/State";

export const revalidate = 60;

const KIND_SHORT = 6;
const KINDS = [1, 2, 4, 3, 6, 5, 7];
const PAGE_SIZE = 30;

type Raw = Record<string, string | string[] | undefined>;
type SP = { searchParams: Promise<Raw> };

function str(v: string | string[] | undefined): string {
  return Array.isArray(v) ? (v[0] ?? "") : (v ?? "");
}

// 从 searchParams 解析出筛选状态
function parse(sp: Raw) {
  const kRaw = Number(str(sp.kind));
  const kind = KINDS.includes(kRaw) ? kRaw : KINDS[0];
  return {
    kind,
    genre: Number(str(sp.genre) || 0),
    tag: str(sp.tag),
    region: str(sp.region),
    year: Number(str(sp.year) || 0),
    sort: str(sp.sort) || "popular",
    adult: str(sp.adult) === "1",
    page: Math.max(1, Number(str(sp.page) || 1)),
  };
}

export async function generateMetadata({ searchParams }: SP): Promise<Metadata> {
  const { kind } = parse(await searchParams);
  const kindLabel = KIND_LABELS[kind] ?? "影视";
  return {
    title: `${kindLabel}大全 - ${BRAND}`,
    description: `在线观看${kindLabel}，按题材、地区、年份筛选，多线路高清播放 - ${BRAND}`,
  };
}

export default async function CategoryPage({ searchParams }: SP) {
  const f = parse(await searchParams);
  const isShort = f.kind === KIND_SHORT;

  // 服务端取数：题材/标签（渲染筛选条）+ 当前筛选下的影片列表
  const [genresData, tagsData, titlesData] = await Promise.all([
    isShort ? Promise.resolve<Genre[]>([]) : serverGetSafe<Genre[]>("/genres", { kind: f.kind }, 300),
    isShort ? serverGetSafe<string[]>("/tags", { kind: f.kind }, 300) : Promise.resolve<string[]>([]),
    serverGetSafe<Paged<Title>>("/titles", {
      kind: f.kind,
      genre: f.genre || undefined,
      tag: isShort && f.tag ? f.tag : undefined,
      adult: f.adult ? 1 : undefined,
      region: !isShort && f.region ? f.region : undefined,
      year: f.year || undefined,
      sort: f.sort,
      page: f.page,
      size: PAGE_SIZE,
    }),
  ]);

  const genres = genresData ?? [];
  const topics = (tagsData ?? []).filter((t) => t !== "短剧"); // 「短剧」类型名本身不作题材
  const list = titlesData?.list ?? [];
  const total = titlesData?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Box sx={{ pt: 1 }}>
      <CategoryFilters genres={genres} topics={topics} />

      <Box sx={{ pt: 2, pb: 2 }}>
        {list.length === 0 ? (
          <Empty text="该筛选下暂无内容" />
        ) : (
          <>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", px: { xs: 1.5, md: 2 }, mb: 1 }}
            >
              共 {total} 部
            </Typography>
            <PosterGrid items={list} />
            <Pager count={pageCount} page={f.page} />
          </>
        )}
      </Box>
    </Box>
  );
}
