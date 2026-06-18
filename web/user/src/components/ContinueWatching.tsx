import { Box, LinearProgress, Typography } from "@mui/material";
import { Link } from "@tanstack/react-router";
import type { Title } from "../api/types";
import PosterImage from "./PosterImage";

export interface HistoryItem {
  id: number;
  title?: Title;
  episode_idx: number;
  position: number;
  duration?: number;
}

export default function ContinueWatching({ items }: { items: HistoryItem[] }) {
  const list = items.filter((i) => i.title);
  if (list.length === 0) {
    return null;
  }
  return (
    <Box sx={{ mt: { xs: 2, md: 3 } }}>
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 700, px: { xs: 1.5, md: 2 }, mb: 1, fontSize: { md: "1.15rem" } }}
      >
        继续观看
      </Typography>
      <Box
        sx={{
          display: "flex",
          gap: { xs: 1.2, md: 1.5 },
          overflowX: "auto",
          px: { xs: 1.5, md: 2 },
          pb: 1,
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {list.map((it) => {
          const t = it.title;
          if (!t) {
            return null;
          }
          const pct =
            it.duration && it.duration > 0
              ? Math.min(100, Math.round((it.position / it.duration) * 100))
              : 0;
          return (
            <Box key={it.id} sx={{ flex: "0 0 auto", width: { xs: 112, sm: 130, md: 150 } }}>
              <Link
                to="/title/$id"
                params={{ id: t.slug || String(t.id) }}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <Box sx={{ position: "relative" }}>
                  <PosterImage src={t.poster} hash={t.poster_blurhash} alt={t.name} adult={t.adult} />
                  {pct > 0 ? (
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 3 }}
                    />
                  ) : null}
                </Box>
                <Typography variant="body2" noWrap sx={{ mt: 0.5, fontWeight: 600 }}>
                  {t.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {it.episode_idx > 1 ? `看到第${it.episode_idx}集` : "继续观看"}
                </Typography>
              </Link>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
