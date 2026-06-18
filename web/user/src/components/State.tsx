import { Box, CircularProgress, Skeleton, Typography } from "@mui/material";

export function Loading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
      <CircularProgress size={28} />
    </Box>
  );
}

export function Empty({ text = "暂无内容" }: { text?: string }) {
  return (
    <Box sx={{ textAlign: "center", color: "text.secondary", py: 8, px: 3 }}>
      <Typography variant="body2">{text}</Typography>
    </Box>
  );
}

// ---- 骨架屏：替代加载转圈，感知更顺滑 ----

export function PosterSkeleton() {
  return (
    <Box>
      <Skeleton
        variant="rounded"
        animation="wave"
        sx={{ width: "100%", aspectRatio: "2 / 3", borderRadius: "8px", bgcolor: "rgba(255,255,255,.06)" }}
      />
      <Skeleton variant="text" width="82%" sx={{ mt: 0.5, bgcolor: "rgba(255,255,255,.06)" }} />
      <Skeleton variant="text" width="48%" sx={{ bgcolor: "rgba(255,255,255,.06)" }} />
    </Box>
  );
}

export function RowSkeleton() {
  return (
    <Box sx={{ mt: { xs: 2, md: 3 } }}>
      <Skeleton
        variant="text"
        width={120}
        height={26}
        sx={{ ml: { xs: 1.5, md: 2 }, mb: 1, bgcolor: "rgba(255,255,255,.06)" }}
      />
      <Box sx={{ display: "flex", gap: { xs: 1.2, md: 1.5 }, px: { xs: 1.5, md: 2 }, overflow: "hidden" }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Box key={i} sx={{ flex: "0 0 auto", width: { xs: 112, sm: 130, md: 150 } }}>
            <PosterSkeleton />
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export function GridSkeleton({ count = 18 }: { count?: number }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "repeat(3, 1fr)",
          sm: "repeat(4, 1fr)",
          md: "repeat(6, 1fr)",
        },
        gap: { xs: 1, md: 1.5 },
        p: { xs: 1.5, md: 2 },
      }}
    >
      {Array.from({ length: count }).map((_, i) => (
        <PosterSkeleton key={i} />
      ))}
    </Box>
  );
}

export function HomeSkeleton() {
  return (
    <Box sx={{ pb: 2 }}>
      <Skeleton
        variant="rounded"
        animation="wave"
        sx={{ width: "100%", aspectRatio: { xs: "16 / 9", md: "21 / 9" }, bgcolor: "rgba(255,255,255,.06)" }}
      />
      <RowSkeleton />
      <RowSkeleton />
      <RowSkeleton />
    </Box>
  );
}
