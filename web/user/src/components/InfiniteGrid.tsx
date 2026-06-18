import { useEffect, useRef } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import type { Title } from "../api/types";
import PosterGrid from "./PosterGrid";
import { Empty, GridSkeleton } from "./State";

interface Props {
  items: Title[];
  loading: boolean;
  isLast: boolean;
  onMore: () => void;
  emptyText?: string;
}

export default function InfiniteGrid({ items, loading, isLast, onMore, emptyText }: Props) {
  const sentinel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinel.current;
    if (!el) {
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && !isLast) {
          onMore();
        }
      },
      { rootMargin: "500px" }, // 提前 500px 预加载
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loading, isLast, onMore]);

  if (items.length === 0) {
    return loading ? <GridSkeleton /> : <Empty text={emptyText} />;
  }
  return (
    <Box>
      <PosterGrid items={items} />
      <Box ref={sentinel} sx={{ height: 1 }} />
      <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
        {loading ? (
          <CircularProgress size={24} />
        ) : isLast && items.length > 0 ? (
          <Typography variant="caption" color="text.disabled">
            没有更多了
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
