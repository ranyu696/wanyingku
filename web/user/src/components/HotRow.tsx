import { useCallback, useEffect, useRef, useState } from "react";
import { Box, CircularProgress, Stack, Typography } from "@mui/material";
import { ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { alova } from "../api/client";
import type { Paged, Title } from "../api/types";
import PosterCard from "./PosterCard";

// 首页横排「侧滑无限加载」：自包含拉取 + onScroll 到右端自动取下一页（按分类 + 热门排序）。
export default function HotRow({ title, kind }: { title: string; kind: number }) {
  const [items, setItems] = useState<Title[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const busy = useRef(false);

  const fetchPage = useCallback(
    async (p: number) => {
      if (busy.current) {
        return;
      }
      busy.current = true;
      setLoading(true);
      try {
        const res = await alova.Get<Paged<Title>>("/titles", {
          params: { kind, sort: "popular", page: p, size: 30 },
        });
        const list = res.list ?? [];
        setTotal(res.total ?? 0);
        setItems((prev) => (p === 1 ? list : [...prev, ...list]));
        setPage(p);
      } catch {
        /* ignore */
      }
      setLoading(false);
      busy.current = false;
    },
    [kind],
  );

  useEffect(() => {
    void fetchPage(1);
  }, [fetchPage]);

  const isLast = total > 0 && items.length >= total;
  const onScroll = () => {
    const el = scrollRef.current;
    if (!el || busy.current || isLast) {
      return;
    }
    // 滑到距右端 600px 内 → 预加载下一页（侧滑无限）
    if (el.scrollLeft + el.clientWidth >= el.scrollWidth - 600) {
      void fetchPage(page + 1);
    }
  };

  if (items.length === 0) {
    return null;
  }
  return (
    <Box sx={{ mt: { xs: 2, md: 3 } }}>
      <Stack
        direction="row"
        sx={{ px: { xs: 1.5, md: 2 }, mb: 1, alignItems: "baseline" }}
      >
        <Typography variant="subtitle1" sx={{ fontWeight: 700, flex: 1, fontSize: { md: "1.15rem" } }}>
          {title}
        </Typography>
        <Link
          to="/category"
          search={{ kind }}
          style={{ textDecoration: "none", color: "inherit" }}
        >
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
        ref={scrollRef}
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
        {loading && !isLast ? (
          <Box
            sx={{
              flex: "0 0 auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
            }}
          >
            <CircularProgress size={22} />
          </Box>
        ) : null}
      </Box>
    </Box>
  );
}
