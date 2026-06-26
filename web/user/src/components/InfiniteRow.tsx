"use client";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Paged, Title } from "@/lib/types";
import PosterCard from "@/components/PosterCard";

const PAGE_SIZE = 12;

// 首页分类横排：服务端给首屏 initial（SEO/秒显），向右滑到头自动按 sort 翻页加载更多 → 无限横滑。
export default function InfiniteRow({
  title,
  kind,
  sort = "popular",
  initial,
}: {
  title: string;
  kind: number;
  sort?: string;
  initial: Title[];
}) {
  const [items, setItems] = useState<Title[]>(initial);
  const [page, setPage] = useState(1);
  const [done, setDone] = useState(initial.length < PAGE_SIZE); // 首屏不足一页 → 没有更多
  const busy = useRef(false);

  const loadMore = useCallback(async () => {
    if (busy.current || done) {
      return;
    }
    busy.current = true;
    const next = page + 1;
    try {
      const data = await api.get<Paged<Title>>("/titles", {
        kind: kind || undefined,
        sort,
        page: next,
        size: PAGE_SIZE,
      });
      const list = data?.list ?? [];
      // 去重：翻页偶有重叠/同片多季
      setItems((prev) => {
        const seen = new Set(prev.map((t) => t.id));
        return [...prev, ...list.filter((t) => !seen.has(t.id))];
      });
      setPage(next);
      if (list.length < PAGE_SIZE) {
        setDone(true);
      }
    } catch {
      setDone(true); // 出错就停，别死循环
    } finally {
      busy.current = false;
    }
  }, [page, kind, sort, done]);

  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollWidth - el.scrollLeft - el.clientWidth < 600) {
      void loadMore();
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <Box sx={{ mt: { xs: 2, md: 3 } }}>
      <Stack direction="row" sx={{ px: { xs: 1.5, md: 2 }, mb: 1, alignItems: "baseline" }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, fontSize: { md: "1.15rem" } }}>
          {title}
        </Typography>
        {kind > 0 ? (
          <Link href={`/category?kind=${kind}`} style={{ textDecoration: "none", color: "inherit" }}>
            <Stack direction="row" sx={{ alignItems: "center", color: "text.secondary", "&:hover": { color: "primary.main" } }}>
              <Typography variant="caption">更多</Typography>
              <ChevronRight size={14} />
            </Stack>
          </Link>
        ) : null}
      </Stack>
      <Box
        onScroll={onScroll}
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
        {items.map((t) => (
          <Box key={t.id} sx={{ flex: "0 0 auto", width: { xs: 112, sm: 130, md: 150 } }}>
            <PosterCard t={t} />
          </Box>
        ))}
        {!done ? (
          <Box sx={{ flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center", width: 64 }}>
            <CircularProgress size={20} />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
