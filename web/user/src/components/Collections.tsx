"use client";
import { useMemo } from "react";
import { Box, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useCollections, useWatching } from "@/lib/hooks";

export default function Collections() {
  const { data } = useCollections();
  const cols = data ?? [];
  const router = useRouter();
  // 专题内预览影片的在看人数（真实，来自观看页心跳），按专题汇总展示
  const ids = useMemo(() => cols.flatMap((c) => c.list.map((t) => t.id)), [cols]);
  const watching = useWatching(ids);
  if (cols.length === 0) {
    return null;
  }
  return (
    <Box sx={{ mt: { xs: 2, md: 3 } }}>
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 700, px: { xs: 1.5, md: 2 }, mb: 1, fontSize: { md: "1.15rem" } }}
      >
        精选专题
      </Typography>
      <Box
        sx={{
          display: "flex",
          gap: 1.2,
          overflowX: "auto",
          px: { xs: 1.5, md: 2 },
          pb: 1,
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {cols.map((c) => {
          const cover = c.list[0]?.backdrop || c.list[0]?.poster;
          const watchers = c.list.reduce((sum, t) => sum + (watching[t.id] ?? 0), 0);
          return (
            <Box
              key={c.key}
              onClick={() => router.push(`/collection/${c.key}`)}
              sx={{
                flex: "0 0 auto",
                width: { xs: 200, sm: 240, md: 264 },
                aspectRatio: "16 / 9",
                position: "relative",
                borderRadius: 2,
                overflow: "hidden",
                cursor: "pointer",
                bgcolor: "#1c1c26",
                transition: "transform .25s ease",
                "&:hover": { transform: "translateY(-2px)" },
              }}
            >
              {cover ? (
                <Box
                  component="img"
                  src={cover}
                  alt={c.title}
                  loading="lazy"
                  sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : null}
              {watchers > 0 ? (
                <Box
                  sx={{
                    position: "absolute",
                    top: 8,
                    left: 8,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    px: 0.9,
                    py: 0.3,
                    borderRadius: 999,
                    bgcolor: "rgba(0,0,0,.6)",
                    backdropFilter: "blur(4px)",
                  }}
                >
                  <Box
                    sx={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      bgcolor: "#ff4d5e",
                      animation: "wykPulse 1.6s ease-in-out infinite",
                      "@keyframes wykPulse": { "0%,100%": { opacity: 1 }, "50%": { opacity: 0.3 } },
                    }}
                  />
                  <Typography sx={{ fontSize: 11, fontWeight: 600, color: "#fff", lineHeight: 1 }}>
                    {watchers} 人在看
                  </Typography>
                </Box>
              ) : null}
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  p: 1.2,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "flex-end",
                  background: "linear-gradient(transparent 30%, rgba(0,0,0,.82))",
                }}
              >
                <Typography sx={{ fontWeight: 700, color: "#fff", fontSize: "1rem" }}>
                  {c.title}
                </Typography>
                <Typography variant="caption" noWrap sx={{ color: "rgba(255,255,255,.75)" }}>
                  {c.desc}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
