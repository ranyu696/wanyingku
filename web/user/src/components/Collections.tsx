import { Box, Typography } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import { useCollections } from "../api/hooks";

export default function Collections() {
  const { data } = useCollections();
  const cols = data ?? [];
  const nav = useNavigate();
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
          return (
            <Box
              key={c.key}
              onClick={() => void nav({ to: "/collection/$key", params: { key: c.key } })}
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
