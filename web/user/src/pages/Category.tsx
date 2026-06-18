import { type ReactNode, useEffect, useState } from "react";
import { Box, ButtonBase, Pagination, Stack, Typography } from "@mui/material";
import { useSearch } from "@tanstack/react-router";
import { useGenres, usePagedTitles, useTags } from "../api/hooks";
import PosterGrid from "../components/PosterGrid";
import { Empty, GridSkeleton } from "../components/State";
import { KIND_LABELS } from "../api/types";
import { useSeo } from "../seo";

const KIND_SHORT = 6; // 短剧
const KINDS = [1, 2, 4, 3, 6, 5, 7]; // 电影 / 电视剧 / 动漫 / 综艺 / 短剧 / 纪录片 / 体育（无「全部」）
// 各类型「题材」里追加的成人项：选中即筛 adult=1（电影→伦理、动漫→里番）
const ADULT_GENRE: Record<number, string> = { 1: "伦理", 4: "里番" };
const regions = ["", "大陆", "香港", "台湾", "美国", "欧美", "日本", "韩国", "泰国"];
const sorts: Array<[string, string]> = [
  ["popular", "热门"],
  ["latest", "最新"],
  ["rating", "高分"],
  ["like", "最赞"],
];
const nowYear = new Date().getFullYear();
const years = [0, ...Array.from({ length: 12 }, (_, i) => nowYear - i)];
const PAGE_SIZE = 30;

// 统一的胶囊筛选项：选中=主色实心+投影，未选=幽灵态（透明底，hover 微亮）
function Pill({
  active,
  large,
  onClick,
  children,
}: {
  active: boolean;
  large?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        flexShrink: 0,
        px: large ? 2.2 : 1.5,
        py: large ? 0.85 : 0.5,
        borderRadius: 999,
        fontSize: large ? 14.5 : 13,
        fontWeight: active ? 700 : 500,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
        color: active ? "#fff" : "text.secondary",
        bgcolor: active ? "primary.main" : "rgba(255,255,255,.05)",
        boxShadow: active ? "0 6px 18px rgba(255,77,94,.32)" : "none",
        transition: "background .16s ease, color .16s ease, box-shadow .16s ease",
        "&:hover": active ? {} : { bgcolor: "rgba(255,255,255,.11)", color: "text.primary" },
      }}
    >
      {children}
    </ButtonBase>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" sx={{ px: { xs: 1.5, md: 2 }, py: 0.55, gap: 1.2, alignItems: "center" }}>
      <Typography
        variant="caption"
        sx={{ width: 30, flexShrink: 0, color: "text.disabled", fontWeight: 600 }}
      >
        {label}
      </Typography>
      <Stack
        direction="row"
        spacing={0.8}
        sx={{ overflowX: "auto", flex: 1, minWidth: 0, "&::-webkit-scrollbar": { display: "none" } }}
      >
        {children}
      </Stack>
    </Stack>
  );
}

export default function Category() {
  const search = useSearch({ from: "/category" }); // 首页「更多」可带 ?kind=&sort= 深链
  const [kind, setKind] = useState(
    search.kind && KINDS.includes(search.kind) ? search.kind : KINDS[0],
  );
  const [genre, setGenre] = useState(0);
  const [tag, setTag] = useState("");
  const [region, setRegion] = useState("");
  const [year, setYear] = useState(0);
  const [sort, setSort] = useState(search.sort ?? "popular");
  const [adultSel, setAdultSel] = useState(false); // 题材选了「伦理/里番」→ 筛 adult
  const [page, setPage] = useState(1);

  const kindLabel = KIND_LABELS[kind] ?? "全部";
  useSeo(`${kindLabel}大全`, `在线观看${kindLabel}，按题材、地区、年份筛选，多线路高清播放 - 万影库`);
  const isShort = kind === KIND_SHORT;
  const genres = useGenres(kind);
  const tags = useTags(kind);
  const genreList = genres.data ?? [];
  // 短剧题材来自片名抽取的标签（「短剧」类型名本身不作题材）
  const topicList = (tags.data ?? []).filter((t) => t !== "短剧");
  const adultGenre = ADULT_GENRE[kind]; // 「伦理」/「里番」/undefined

  // 只保留「题材」：非短剧=TMDB 题材(+成人项)，短剧=片名题材标签；不再有独立「标签」筛选
  const showGenreRow = !isShort && (genreList.length > 0 || Boolean(adultGenre));
  const showTopicRow = isShort && topicList.length > 0;

  const params = {
    kind,
    genre: genre || undefined,
    tag: isShort && tag ? tag : undefined, // 仅短剧用题材标签筛选
    adult: adultSel ? 1 : undefined,
    region: !isShort && region ? region : undefined, // 短剧地区无意义
    year: year || undefined,
    sort,
  };
  const { data, loading } = usePagedTitles(params, page, PAGE_SIZE);
  const list = data?.list ?? [];
  const total = data?.total ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 任一筛选变化 → 回到第 1 页
  useEffect(() => {
    setPage(1);
  }, [kind, genre, tag, adultSel, region, year, sort]);

  const onKind = (k: number) => {
    setKind(k);
    setGenre(0);
    setTag("");
    setAdultSel(false);
    setRegion("");
  };

  const changePage = (_: unknown, p: number) => {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <Box sx={{ pt: 1 }}>
      {/* 筛选面板（吸顶） */}
      <Box
        sx={{
          position: "sticky",
          top: { xs: 52, md: 60 },
          zIndex: 5,
          bgcolor: "rgba(10,10,15,.86)",
          backdropFilter: "blur(14px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        {/* 主分类 tab（醒目，无「全部」） */}
        <Stack
          direction="row"
          spacing={1}
          sx={{
            px: { xs: 1.5, md: 2 },
            pt: 1.2,
            pb: 1.2,
            overflowX: "auto",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {KINDS.map((k) => (
            <Pill key={k} large active={kind === k} onClick={() => onKind(k)}>
              {KIND_LABELS[k]}
            </Pill>
          ))}
        </Stack>

        {/* 二级筛选 */}
        <Box sx={{ borderTop: "1px solid", borderColor: "divider", py: 0.6 }}>
          {showGenreRow ? (
            <FilterRow label="题材">
              <Pill
                active={genre === 0 && !adultSel}
                onClick={() => {
                  setGenre(0);
                  setAdultSel(false);
                }}
              >
                全部
              </Pill>
              {genreList.map((g) => (
                <Pill
                  key={g.id}
                  active={genre === g.id && !adultSel}
                  onClick={() => {
                    setGenre(g.id);
                    setAdultSel(false);
                  }}
                >
                  {g.name}
                </Pill>
              ))}
              {adultGenre ? (
                <Pill
                  active={adultSel}
                  onClick={() => {
                    setAdultSel(true);
                    setGenre(0);
                  }}
                >
                  {adultGenre}
                </Pill>
              ) : null}
            </FilterRow>
          ) : null}

          {showTopicRow ? (
            <FilterRow label="题材">
              <Pill active={tag === ""} onClick={() => setTag("")}>
                全部
              </Pill>
              {topicList.map((t) => (
                <Pill key={t} active={tag === t} onClick={() => setTag(t)}>
                  {t}
                </Pill>
              ))}
            </FilterRow>
          ) : null}

          {!isShort ? (
            <FilterRow label="地区">
              {regions.map((r) => (
                <Pill key={r || "all"} active={region === r} onClick={() => setRegion(r)}>
                  {r || "全部"}
                </Pill>
              ))}
            </FilterRow>
          ) : null}

          <FilterRow label="年份">
            {years.map((y) => (
              <Pill key={y} active={year === y} onClick={() => setYear(y)}>
                {y === 0 ? "全部" : y}
              </Pill>
            ))}
          </FilterRow>

          <FilterRow label="排序">
            {sorts.map(([v, l]) => (
              <Pill key={v} active={sort === v} onClick={() => setSort(v)}>
                {l}
              </Pill>
            ))}
          </FilterRow>
        </Box>
      </Box>

      {/* 结果 */}
      <Box sx={{ pt: 2, pb: 2 }}>
        {loading && list.length === 0 ? (
          <GridSkeleton />
        ) : list.length === 0 ? (
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
            {pageCount > 1 ? (
              <Stack sx={{ mt: 3, alignItems: "center" }}>
                <Pagination
                  count={pageCount}
                  page={page}
                  onChange={changePage}
                  color="primary"
                  shape="rounded"
                  siblingCount={1}
                  boundaryCount={1}
                />
              </Stack>
            ) : null}
          </>
        )}
      </Box>
    </Box>
  );
}
