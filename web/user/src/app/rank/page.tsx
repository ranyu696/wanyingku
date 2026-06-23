import type { Metadata } from "next";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { Play } from "lucide-react";
import Link from "next/link";
import { serverGetSafe } from "@/lib/api";
import { BRAND } from "@/lib/site";
import { KIND_LABELS, type Paged, type Title } from "@/lib/types";
import PosterImage from "@/components/PosterImage";
import RankToggles from "@/components/RankToggles";
import { Empty } from "@/components/State";

export const revalidate = 60;

export const metadata: Metadata = { title: `影视排行榜 - ${BRAND}` };

function scoreOf(t: Title, sort: string): string {
  if (sort === "rating") {
    return t.vote_average ? `★ ${t.vote_average.toFixed(1)}` : "";
  }
  if (sort === "like") {
    return t.like_count ? `${t.like_count} 赞` : "";
  }
  if (sort === "latest") {
    return t.latest_episode > 1 ? `更新${t.latest_episode}` : "";
  }
  return t.source_count > 1 ? `${t.source_count} 线路` : "";
}

function meta(t: Title): string {
  return [KIND_LABELS[t.kind], t.year || "", t.area || ""].filter(Boolean).join(" · ");
}

function Hero({ t, sort }: { t: Title; sort: string }) {
  return (
    <Link href={`/title/${t.slug || t.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <Box
        sx={{
          position: "relative",
          mx: { xs: 1.5, md: 2 },
          borderRadius: "16px",
          overflow: "hidden",
          boxShadow: "0 16px 40px rgba(0,0,0,.5)",
        }}
      >
        <PosterImage
          src={t.backdrop || t.poster}
          hash={t.backdrop_blurhash || t.poster_blurhash}
          ratio="16 / 9"
          alt={t.name}
          adult={t.adult}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(0,0,0,.85) 0%, rgba(0,0,0,.4) 45%, transparent 75%)",
          }}
        />
        <Box sx={{ position: "absolute", left: 0, bottom: 0, p: { xs: 2, md: 3 }, maxWidth: "85%" }}>
          <Typography
            sx={{
              fontWeight: 900,
              fontStyle: "italic",
              lineHeight: 0.9,
              fontSize: { xs: "3.4rem", md: "5rem" },
              background: "linear-gradient(135deg,#ff3d5a,#ffb13d)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            1
          </Typography>
          <Typography variant="h6" sx={{ color: "#fff", fontWeight: 800, mt: 0.5 }} noWrap>
            {t.name}
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,.75)", mb: 1 }} noWrap>
            {[scoreOf(t, sort), meta(t)].filter(Boolean).join("  ·  ")}
          </Typography>
          <Chip
            icon={<Play size={15} />}
            label="立即观看"
            color="primary"
            sx={{ fontWeight: 700, "& .MuiChip-icon": { color: "#fff", ml: 0.8 } }}
          />
        </Box>
      </Box>
    </Link>
  );
}

function PodiumCard({ t, rank, sort }: { t: Title; rank: number; sort: string }) {
  return (
    <Link
      href={`/title/${t.slug || t.id}`}
      style={{ textDecoration: "none", color: "inherit", flex: "1 1 0", minWidth: 0 }}
    >
      <Box sx={{ position: "relative" }}>
        <PosterImage src={t.poster} hash={t.poster_blurhash} alt={t.name} ratio="3 / 4" adult={t.adult} />
        <Box
          sx={{
            position: "absolute",
            top: 6,
            left: 6,
            width: 26,
            height: 26,
            borderRadius: "8px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 800,
            fontStyle: "italic",
            fontSize: 15,
            color: "#fff",
            bgcolor: rank === 2 ? "rgba(160,170,190,.95)" : "rgba(205,127,80,.95)",
          }}
        >
          {rank}
        </Box>
      </Box>
      <Typography variant="body2" noWrap sx={{ mt: 0.5, fontWeight: 600 }}>
        {t.name}
      </Typography>
      <Typography variant="caption" color="primary.main" noWrap sx={{ display: "block" }}>
        {scoreOf(t, sort) || meta(t)}
      </Typography>
    </Link>
  );
}

function RankRow({ t, rank, sort }: { t: Title; rank: number; sort: string }) {
  return (
    <Link href={`/title/${t.slug || t.id}`} style={{ textDecoration: "none", color: "inherit" }}>
      <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", py: 0.75 }}>
        <Typography
          sx={{ width: 26, textAlign: "center", fontWeight: 800, fontStyle: "italic", color: "text.disabled" }}
        >
          {rank}
        </Typography>
        <Box sx={{ width: 44, flexShrink: 0 }}>
          <PosterImage src={t.poster} hash={t.poster_blurhash} alt={t.name} adult={t.adult} />
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
            {t.name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {meta(t)}
          </Typography>
        </Box>
        {scoreOf(t, sort) ? (
          <Typography variant="body2" color="primary.main" sx={{ fontWeight: 700, flexShrink: 0 }}>
            {scoreOf(t, sort)}
          </Typography>
        ) : null}
      </Stack>
    </Link>
  );
}

type SP = { searchParams: Promise<{ sort?: string; kind?: string }> };

export default async function RankPage({ searchParams }: SP) {
  const sp = await searchParams;
  const sort = sp.sort || "popular";
  const kind = sp.kind ? Number(sp.kind) : 0;
  const data = await serverGetSafe<Paged<Title>>("/titles", {
    kind: kind || undefined,
    sort,
    size: 50,
  });
  const list = data?.list ?? [];

  return (
    <Box sx={{ pt: 1.5 }}>
      <RankToggles sort={sort} kind={kind} />
      {list.length === 0 ? (
        <Empty />
      ) : (
        <Box>
          <Hero t={list[0]} sort={sort} />
          {list.length > 1 ? (
            <Stack direction="row" spacing={1.5} sx={{ px: { xs: 1.5, md: 2 }, mt: 2 }}>
              {list.slice(1, 3).map((t, i) => (
                <PodiumCard key={t.id} t={t} rank={i + 2} sort={sort} />
              ))}
            </Stack>
          ) : null}
          <Stack
            sx={{ px: { xs: 1.5, md: 2 }, mt: 2, gap: 0.5 }}
            divider={<Box sx={{ borderTop: "1px solid", borderColor: "divider" }} />}
          >
            {list.slice(3).map((t, i) => (
              <RankRow key={t.id} t={t} rank={i + 4} sort={sort} />
            ))}
          </Stack>
        </Box>
      )}
    </Box>
  );
}
