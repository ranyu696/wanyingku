import Link from "next/link";
import { Box, Chip, Typography } from "@mui/material";
import { CirclePlay } from "lucide-react";
import type { Title } from "@/lib/types";
import PosterImage from "./PosterImage";

export default function PosterCard({ t }: { t: Title }) {
  const rating = t.douban_rating
    ? `豆 ${t.douban_rating.toFixed(1)}`
    : t.vote_average
      ? `★ ${t.vote_average.toFixed(1)}`
      : "";
  const isDouban = Boolean(t.douban_rating);
  const meta = String(t.year || "");
  return (
    <Link
      href={`/title/${t.slug || t.id}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <Box
        sx={{
          position: "relative",
          borderRadius: "8px",
          overflow: "hidden",
          transition: "box-shadow .3s ease, transform .3s ease",
          "&:hover": { boxShadow: "0 12px 30px rgba(0,0,0,.55)", transform: "translateY(-2px)" },
          "&:hover img": { transform: "scale(1.07)" },
          "&:hover .play-ov": { opacity: 1 },
        }}
      >
        <PosterImage src={t.poster} hash={t.poster_blurhash} alt={t.name} adult={t.adult} />
        <Box
          className="play-ov"
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            opacity: 0,
            pointerEvents: "none", // 纯装饰，不挡成人遮罩/跳转点击
            transition: "opacity .3s ease",
            background: "linear-gradient(transparent 45%, rgba(0,0,0,.55))",
          }}
        >
          <CirclePlay size={44} color="rgba(255,255,255,.95)" strokeWidth={1.5} />
        </Box>
        {t.source_count > 1 ? (
          <Chip
            size="small"
            label={`${t.source_count}源`}
            sx={{
              position: "absolute",
              top: 6,
              left: 6,
              height: 20,
              bgcolor: "rgba(0,0,0,.62)",
              fontSize: 11,
            }}
          />
        ) : null}
        {rating ? (
          <Box
            sx={{
              position: "absolute",
              top: 6,
              right: 6,
              px: 0.6,
              py: "1px",
              borderRadius: "4px",
              bgcolor: "rgba(0,0,0,.66)",
              fontSize: 11,
              fontWeight: 700,
              lineHeight: 1.5,
              color: isDouban ? "#ffce3d" : "#fff",
            }}
          >
            {rating}
          </Box>
        ) : null}
        {t.latest_episode > 1 ? (
          <Chip
            size="small"
            color="primary"
            label={t.serial_complete ? `全${t.latest_episode}集` : `更新${t.latest_episode}`}
            sx={{ position: "absolute", bottom: 6, right: 6, height: 20, fontSize: 11 }}
          />
        ) : null}
        {/* 成人标记：里番等成人作品常与主流剧重名，加 18+ 一眼区分 */}
        {t.adult ? (
          <Box
            sx={{
              position: "absolute",
              bottom: 6,
              left: 6,
              px: 0.6,
              py: "1px",
              borderRadius: "4px",
              bgcolor: "rgba(220,38,56,.92)",
              fontSize: 10.5,
              fontWeight: 800,
              lineHeight: 1.5,
              letterSpacing: 0.3,
              color: "#fff",
            }}
          >
            18+
          </Box>
        ) : null}
      </Box>
      <Typography variant="body2" noWrap sx={{ mt: 0.5, fontWeight: 600 }}>
        {t.name}
      </Typography>
      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
        {meta}
      </Typography>
    </Link>
  );
}
