"use client";
import { type ReactNode } from "react";
import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { KIND_LABELS, type Genre } from "@/lib/types";

const KIND_SHORT = 6;
const KINDS = [1, 2, 4, 3, 6, 5, 7]; // 电影/电视剧/动漫/综艺/短剧/纪录片/体育
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
      <Typography variant="caption" sx={{ width: 30, flexShrink: 0, color: "text.disabled", fontWeight: 600 }}>
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

// 分类筛选条（吸顶）：每次选择都改 URL searchParams，由服务端重新取数渲染。
export default function CategoryFilters({ genres, topics }: { genres: Genre[]; topics: string[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const kind = sp.get("kind") && KINDS.includes(Number(sp.get("kind"))) ? Number(sp.get("kind")) : KINDS[0];
  const genre = Number(sp.get("genre") || 0);
  const tag = sp.get("tag") || "";
  const region = sp.get("region") || "";
  const year = Number(sp.get("year") || 0);
  const sort = sp.get("sort") || "popular";
  const adultSel = sp.get("adult") === "1";
  const isShort = kind === KIND_SHORT;
  const adultGenre = ADULT_GENRE[kind];

  // 改若干筛选项 → 重置 page 后 push。null 值表示删除该参数。
  const apply = (updates: Record<string, string | number | null>) => {
    const next = new URLSearchParams(sp.toString());
    next.delete("page");
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "" || v === 0) {
        next.delete(k);
      } else {
        next.set(k, String(v));
      }
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  // 切主分类：清空二级筛选（题材/地区/成人）
  const onKind = (k: number) =>
    apply({ kind: k, genre: null, tag: null, adult: null, region: null });

  const showGenreRow = !isShort && (genres.length > 0 || Boolean(adultGenre));
  const showTopicRow = isShort && topics.length > 0;

  return (
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
      {/* 主分类 tab */}
      <Stack
        direction="row"
        spacing={1}
        sx={{ px: { xs: 1.5, md: 2 }, pt: 1.2, pb: 1.2, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" } }}
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
            <Pill active={genre === 0 && !adultSel} onClick={() => apply({ genre: null, adult: null })}>
              全部
            </Pill>
            {genres.map((g) => (
              <Pill
                key={g.id}
                active={genre === g.id && !adultSel}
                onClick={() => apply({ genre: g.id, adult: null })}
              >
                {g.name}
              </Pill>
            ))}
            {adultGenre ? (
              <Pill active={adultSel} onClick={() => apply({ adult: 1, genre: null })}>
                {adultGenre}
              </Pill>
            ) : null}
          </FilterRow>
        ) : null}

        {showTopicRow ? (
          <FilterRow label="题材">
            <Pill active={tag === ""} onClick={() => apply({ tag: null })}>
              全部
            </Pill>
            {topics.map((t) => (
              <Pill key={t} active={tag === t} onClick={() => apply({ tag: t })}>
                {t}
              </Pill>
            ))}
          </FilterRow>
        ) : null}

        {!isShort ? (
          <FilterRow label="地区">
            {regions.map((r) => (
              <Pill key={r || "all"} active={region === r} onClick={() => apply({ region: r || null })}>
                {r || "全部"}
              </Pill>
            ))}
          </FilterRow>
        ) : null}

        <FilterRow label="年份">
          {years.map((y) => (
            <Pill key={y} active={year === y} onClick={() => apply({ year: y || null })}>
              {y === 0 ? "全部" : y}
            </Pill>
          ))}
        </FilterRow>

        <FilterRow label="排序">
          {sorts.map(([v, l]) => (
            <Pill key={v} active={sort === v} onClick={() => apply({ sort: v })}>
              {l}
            </Pill>
          ))}
        </FilterRow>
      </Box>
    </Box>
  );
}
