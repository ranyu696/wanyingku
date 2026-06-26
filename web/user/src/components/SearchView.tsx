"use client";
import { useEffect, useRef, useState } from "react";
import { Box, Chip, InputBase, Paper, Stack, Typography } from "@mui/material";
import { useRouter, useSearchParams } from "next/navigation";
import { useHotSearches, useInfinite } from "@/lib/hooks";
import InfiniteGrid from "@/components/InfiniteGrid";
import { KIND_LABELS } from "@/lib/types";

const KINDS = [0, 1, 2, 4, 3, 6, 5];

function Results({ q, kind, semantic }: { q: string; kind: number; semantic: boolean }) {
  const inf = useInfinite("/search", {
    q,
    kind: kind || undefined,
    mode: semantic ? "semantic" : undefined,
  });
  return (
    <Box sx={{ mt: 1 }}>
      <InfiniteGrid
        items={inf.items}
        loading={inf.loading}
        isLast={inf.isLast}
        onMore={inf.loadMore}
        emptyText="没有找到，去『我的 → 求片』催一下吧"
      />
    </Box>
  );
}

// 热搜标签云：按热度排名变字号/配色，前三高亮带名次
function HotCloud({ onPick }: { onPick: (k: string) => void }) {
  const hot = useHotSearches();
  const list = hot.data ?? [];
  if (list.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ mt: 4, textAlign: "center" }}>
        输入关键词开始搜索
      </Typography>
    );
  }
  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, pt: 2.5 }}>
      <Typography variant="subtitle2" sx={{ mb: 1.4 }}>
        🔥 热搜榜
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, alignItems: "center" }}>
        {list.map((k, i) => {
          const top = i < 3;
          const fontSize = i === 0 ? "1.25rem" : i < 3 ? "1.08rem" : i < 6 ? "0.95rem" : "0.85rem";
          return (
            <Box
              key={k}
              onClick={() => onPick(k)}
              sx={{
                cursor: "pointer",
                px: 1.6,
                py: 0.6,
                borderRadius: 999,
                fontSize,
                fontWeight: top ? 800 : 500,
                lineHeight: 1.6,
                color: top ? "#fff" : "text.primary",
                bgcolor: top ? "primary.main" : "rgba(255,255,255,.06)",
                border: "1px solid",
                borderColor: top ? "transparent" : "divider",
                transition: "transform .12s, background .15s",
                "&:hover": {
                  transform: "translateY(-1px)",
                  bgcolor: top ? "primary.dark" : "rgba(255,255,255,.13)",
                },
              }}
            >
              {top ? (
                <Box component="span" sx={{ opacity: 0.85, mr: 0.5 }}>
                  {i + 1}
                </Box>
              ) : null}
              {k}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

export default function SearchView() {
  const router = useRouter();
  const sp = useSearchParams();
  // 从 URL 初始化：直达 /search?q=...&kind=...&mode=semantic 可还原搜索（可分享/可索引/可回退）
  const [q, setQ] = useState(() => sp.get("q") ?? ""); // 输入框显示值（含输入法合成中的拼音）
  const [query, setQuery] = useState(() => sp.get("q") ?? ""); // 真正提交搜索的值（合成结束 + 防抖后）
  const [kind, setKind] = useState(() => Number(sp.get("kind")) || 0);
  const [semantic, setSemantic] = useState(() => sp.get("mode") === "semantic");
  const composing = useRef(false); // 输入法合成中（打拼音组字）标记
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 防抖提交：合成中不提交，避免把半截拼音「zhengzha」当关键词搜
  const commit = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setQuery(v), 300);
  };
  useEffect(() => () => clearTimeout(timer.current ?? undefined), []);

  // 把已提交的搜索状态同步进 URL（replace 不灌历史）：地址栏始终反映当前搜索
  useEffect(() => {
    const next = new URLSearchParams();
    const trimmed = query.trim();
    if (trimmed) next.set("q", trimmed);
    if (kind) next.set("kind", String(kind));
    if (semantic) next.set("mode", "semantic");
    const qs = next.toString();
    router.replace(qs ? `/search?${qs}` : "/search", { scroll: false });
  }, [query, kind, semantic, router]);

  const onInput = (v: string) => {
    setQ(v);
    if (!composing.current) commit(v);
  };
  const pick = (k: string) => {
    setQ(k);
    setQuery(k); // 点热搜立即搜
  };

  const trimmed = query.trim();
  return (
    <Box sx={{ pt: 1.5 }}>
      <Paper sx={{ mx: { xs: 1.5, md: 2 }, px: 2, py: 0.6, borderRadius: 5, bgcolor: "#1c1c26" }}>
        <InputBase
          placeholder={semantic ? "用一句话描述你想看的…" : "搜电影、剧集、综艺、动漫…"}
          fullWidth
          value={q}
          onChange={(e) => onInput(e.target.value)}
          autoFocus
          sx={{ color: "#fff" }}
          inputProps={{
            onCompositionStart: () => {
              composing.current = true;
            },
            onCompositionEnd: (e: React.CompositionEvent<HTMLInputElement>) => {
              composing.current = false;
              commit(e.currentTarget.value); // 中文上屏后再搜
            },
          }}
        />
      </Paper>
      <Stack direction="row" sx={{ px: { xs: 1.5, md: 2 }, mt: 1, gap: 1, alignItems: "center" }}>
        <Chip
          label="🧠 语义搜索"
          size="small"
          color={semantic ? "secondary" : "default"}
          variant={semantic ? "filled" : "outlined"}
          onClick={() => setSemantic((v) => !v)}
        />
        <Typography variant="caption" color="text.secondary">
          {semantic ? "按意思找相近的（AI 向量）" : "关键词精确匹配"}
        </Typography>
      </Stack>

      {trimmed ? (
        <>
          <Stack
            direction="row"
            spacing={0.8}
            sx={{ px: { xs: 1.5, md: 2 }, mt: 1.2, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" } }}
          >
            {KINDS.map((k) => (
              <Chip
                key={k}
                size="small"
                label={k === 0 ? "全部" : KIND_LABELS[k]}
                color={kind === k ? "primary" : "default"}
                variant={kind === k ? "filled" : "outlined"}
                onClick={() => setKind(k)}
                sx={{ flexShrink: 0 }}
              />
            ))}
          </Stack>
          <Results q={trimmed} kind={kind} semantic={semantic} />
        </>
      ) : (
        <HotCloud onPick={pick} />
      )}
    </Box>
  );
}
