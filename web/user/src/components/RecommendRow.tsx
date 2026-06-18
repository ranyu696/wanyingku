import { Box, Typography } from "@mui/material";
import { Link } from "@tanstack/react-router";
import { useRecommend } from "../api/hooks";
import { useAuth } from "../store/auth";
import PosterImage from "./PosterImage";

// 为你推荐：基于观看历史/收藏的个性化片单，仅登录后展示，空则不渲染。
export default function RecommendRow() {
  const { token } = useAuth();
  const { data } = useRecommend(Boolean(token));
  const list = data ?? [];
  if (!token || list.length === 0) {
    return null;
  }
  return (
    <Box sx={{ mt: { xs: 2, md: 3 } }}>
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 700, px: { xs: 1.5, md: 2 }, mb: 1, fontSize: { md: "1.15rem" } }}
      >
        ✨ 为你推荐
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
        {list.map((t) => {
          const rating = t.douban_rating
            ? `豆${t.douban_rating.toFixed(1)}`
            : t.vote_average
              ? `★${t.vote_average.toFixed(1)}`
              : "";
          const meta = [t.year || "", rating].filter(Boolean).join(" · ");
          return (
            <Box key={t.id} sx={{ flex: "0 0 auto", width: { xs: 112, sm: 130, md: 150 } }}>
              <Link
                to="/title/$id"
                params={{ id: t.slug || String(t.id) }}
                style={{ textDecoration: "none", color: "inherit" }}
              >
                <PosterImage src={t.poster} hash={t.poster_blurhash} alt={t.name} adult={t.adult} />
                <Typography variant="body2" noWrap sx={{ mt: 0.5, fontWeight: 600 }}>
                  {t.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {meta}
                </Typography>
              </Link>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
