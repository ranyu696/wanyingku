"use client";
import { useEffect, useRef, useState } from "react";
import { Box, Chip, IconButton, Stack, Typography } from "@mui/material";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import Link from "next/link";
import { KIND_LABELS, type Title } from "@/lib/types";
import Blurhash from "./Blurhash";

// 首屏大图按显示宽取图：自有图床支持 ?w= 缩放，避免下/解码 3840px 原图（移动端 LCP/解码杀手）。
const HERO_WIDTHS = [640, 960, 1280, 1920];
function heroImg(url: string): { src: string; srcSet?: string } {
  if (!url.includes("/api/v1/img/")) {
    return { src: url };
  }
  return {
    src: `${url}?w=1280`, // 不支持 srcset 时的兜底，也远小于原图
    srcSet: HERO_WIDTHS.map((w) => `${url}?w=${w} ${w}w`).join(", "),
  };
}

export default function HeroCarousel({ items }: { items: Title[] }) {
  const list = items.filter((t) => !t.adult).slice(0, 6); // 成人内容不进首页大图
  const [idx, setIdx] = useState(0);
  const pausedRef = useRef(false);
  const touchX = useRef<number | null>(null);

  const go = (n: number) => {
    if (list.length === 0) {
      return;
    }
    setIdx((i) => (i + n + list.length) % list.length);
  };

  useEffect(() => {
    if (list.length <= 1) {
      return;
    }
    const id = window.setInterval(() => {
      if (!pausedRef.current) {
        setIdx((i) => (i + 1) % list.length);
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [list.length]);

  if (list.length === 0) {
    return null;
  }

  return (
    <Box
      onMouseEnter={() => {
        pausedRef.current = true;
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
      }}
      onTouchStart={(e) => {
        touchX.current = e.touches[0].clientX;
      }}
      onTouchEnd={(e) => {
        if (touchX.current == null) {
          return;
        }
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (Math.abs(dx) > 40) {
          go(dx < 0 ? 1 : -1);
        }
        touchX.current = null;
      }}
      sx={{
        position: "relative",
        height: { xs: 210, sm: 300, md: 400, lg: 460 },
        mx: { md: 2 },
        mt: { md: 2 },
        borderRadius: { md: "18px" },
        overflow: "hidden",
        bgcolor: "#101019",
        "&:hover .hero-arrow": { opacity: 1 },
      }}
    >
      {list.map((t, i) => {
        const hash = t.backdrop_blurhash || t.poster_blurhash;
        const active = i === idx;
        return (
          <Box
            key={t.id}
            sx={{
              position: "absolute",
              inset: 0,
              opacity: active ? 1 : 0,
              transition: "opacity .8s ease",
              pointerEvents: active ? "auto" : "none",
            }}
          >
            <Link
              href={`/title/${t.slug || t.id}`}
              prefetch
              style={{ display: "block", height: "100%", textDecoration: "none", color: "inherit" }}
            >
              {hash ? (
                <Box sx={{ position: "absolute", inset: 0 }}>
                  <Blurhash hash={hash} />
                </Box>
              ) : null}
              <Box
                component="img"
                {...heroImg(t.backdrop || t.poster || "")}
                sizes="(max-width: 1320px) 100vw, 1320px"
                alt={t.name}
                loading={i === 0 ? "eager" : "lazy"}
                fetchPriority={i === 0 ? "high" : "auto"}
                sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
              />
              <Box
                sx={{
                  position: "absolute",
                  inset: 0,
                  background:
                    "linear-gradient(90deg, rgba(0,0,0,.88) 0%, rgba(0,0,0,.35) 50%, transparent 80%), linear-gradient(0deg, rgba(0,0,0,.65), transparent 55%)",
                }}
              />
              <Box sx={{ position: "absolute", left: 0, bottom: 0, p: { xs: 2, md: 4 }, maxWidth: { xs: "92%", md: "55%" } }}>
                <Typography variant="h5" sx={{ color: "#fff", fontWeight: 800 }} noWrap>
                  {t.name}
                </Typography>
                <Typography variant="body2" sx={{ color: "rgba(255,255,255,.78)", mt: 0.5 }} noWrap>
                  {[
                    KIND_LABELS[t.kind],
                    t.year || "",
                    t.vote_average ? `★${t.vote_average.toFixed(1)}` : "",
                    t.area || "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Typography>
                {t.overview ? (
                  <Typography
                    variant="body2"
                    sx={{
                      color: "rgba(255,255,255,.6)",
                      mt: 0.5,
                      display: { xs: "none", md: "-webkit-box" },
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {t.overview}
                  </Typography>
                ) : null}
                <Chip
                  icon={<Play size={16} />}
                  label="立即观看"
                  color="primary"
                  sx={{ mt: 1.5, fontWeight: 700, height: 36, px: 1, "& .MuiChip-icon": { color: "#fff", ml: 1 } }}
                />
              </Box>
            </Link>
          </Box>
        );
      })}

      {list.length > 1 ? (
        <>
          <IconButton
            className="hero-arrow"
            onClick={() => go(-1)}
            aria-label="上一张"
            sx={{
              position: "absolute",
              left: 8,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 2,
              color: "#fff",
              bgcolor: "rgba(0,0,0,.4)",
              opacity: 0,
              transition: "opacity .25s",
              display: { xs: "none", md: "flex" },
              "&:hover": { bgcolor: "rgba(0,0,0,.6)" },
            }}
          >
            <ChevronLeft size={22} />
          </IconButton>
          <IconButton
            className="hero-arrow"
            onClick={() => go(1)}
            aria-label="下一张"
            sx={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              zIndex: 2,
              color: "#fff",
              bgcolor: "rgba(0,0,0,.4)",
              opacity: 0,
              transition: "opacity .25s",
              display: { xs: "none", md: "flex" },
              "&:hover": { bgcolor: "rgba(0,0,0,.6)" },
            }}
          >
            <ChevronRight size={22} />
          </IconButton>
        </>
      ) : null}

      <Stack direction="row" spacing={0.8} sx={{ position: "absolute", bottom: 12, right: 16, zIndex: 2 }}>
        {list.map((t, i) => (
          <Box
            key={t.id}
            onClick={() => setIdx(i)}
            sx={{
              width: i === idx ? 18 : 8,
              height: 8,
              borderRadius: 4,
              cursor: "pointer",
              bgcolor: i === idx ? "primary.main" : "rgba(255,255,255,.5)",
              transition: "all .3s",
            }}
          />
        ))}
      </Stack>
    </Box>
  );
}
