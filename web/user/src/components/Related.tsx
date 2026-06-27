"use client";
import { Box } from "@mui/material";
import { useRelated } from "@/lib/hooks";
import PosterCard from "./PosterCard";

// 详情页「相关推荐」客户端岛：按 titleId 拉相关，横排展示。
export default function Related({ tid }: { tid: number }) {
  const { data } = useRelated(tid);
  const list = data ?? [];
  if (list.length === 0) {
    return null;
  }
  return (
    <Box
      sx={{
        display: "flex",
        gap: 1.2,
        overflowX: "auto",
        pb: 1,
        scrollSnapType: "x mandatory",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {list.map((t) => (
        <Box
          key={t.id}
          sx={{ flex: "0 0 auto", width: { xs: 112, sm: 130, md: 150 }, scrollSnapAlign: "start" }}
        >
          <PosterCard t={t} prefetch />
        </Box>
      ))}
    </Box>
  );
}
