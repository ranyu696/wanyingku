import { Box, CircularProgress, Skeleton, Stack, Typography } from "@mui/material";

const SK = "rgba(255,255,255,.06)"; // 骨架统一底色

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

// 分类筛选条骨架：主分类 tab 行 + 二级筛选行（题材/地区/年份/排序），贴合 CategoryFilters，消除 loading→数据到位时网格下移
export function CategoryFiltersSkeleton() {
  const rows = [5, 8, 12, 4]; // 各筛选行的胶囊数（题材/地区/年份/排序）
  return (
    <Box sx={{ borderBottom: "1px solid", borderColor: "divider" }}>
      {/* 主分类 tab */}
      <Stack direction="row" spacing={1} sx={{ px: { xs: 1.5, md: 2 }, pt: 1.2, pb: 1.2, overflow: "hidden" }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={52} height={32} sx={{ flexShrink: 0, borderRadius: 999, bgcolor: SK }} />
        ))}
      </Stack>
      {/* 二级筛选 */}
      <Box sx={{ borderTop: "1px solid", borderColor: "divider", py: 0.6 }}>
        {rows.map((n, r) => (
          <Stack key={r} direction="row" sx={{ px: { xs: 1.5, md: 2 }, py: 0.55, gap: 1.2, alignItems: "center", overflow: "hidden" }}>
            <Skeleton variant="text" width={24} sx={{ flexShrink: 0, bgcolor: SK }} />
            {Array.from({ length: n }).map((_, i) => (
              <Skeleton key={i} variant="rounded" width={36 + ((i * 13) % 28)} height={26} sx={{ flexShrink: 0, borderRadius: 999, bgcolor: SK }} />
            ))}
          </Stack>
        ))}
      </Box>
    </Box>
  );
}

// 分类页骨架：筛选条 + 网格
export function CategorySkeleton() {
  return (
    <Box sx={{ pt: 1 }}>
      <CategoryFiltersSkeleton />
      <Box sx={{ pt: 2 }}>
        <GridSkeleton />
      </Box>
    </Box>
  );
}

export function HomeSkeleton() {
  return (
    <Box sx={{ pb: 2 }}>
      <Skeleton
        variant="rounded"
        animation="wave"
        sx={{ width: "100%", aspectRatio: { xs: "16 / 9", md: "21 / 9" }, bgcolor: SK }}
      />
      <RowSkeleton />
      <RowSkeleton />
      <RowSkeleton />
    </Box>
  );
}

// 详情页骨架：模糊 hero（左海报 2:3 + 右信息行 + 操作按钮）+ 简介 + 相关横排，贴合 title/[id]
export function DetailSkeleton() {
  return (
    <Box sx={{ pb: 3 }}>
      <Box sx={{ bgcolor: "#101019" }}>
        <Box sx={{ display: "flex", gap: { xs: 1.5, md: 3 }, p: { xs: 2, md: 3 }, alignItems: "flex-end" }}>
          <Box sx={{ width: { xs: 116, sm: 150, md: 200 }, flexShrink: 0 }}>
            <Skeleton variant="rounded" animation="wave" sx={{ width: "100%", aspectRatio: "2 / 3", borderRadius: 2, bgcolor: SK }} />
          </Box>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Skeleton variant="text" width="65%" height={34} sx={{ bgcolor: SK }} />
            <Skeleton variant="text" width="40%" sx={{ bgcolor: SK }} />
            <Skeleton variant="text" width="52%" sx={{ mt: 1, bgcolor: SK }} />
            <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
              <Skeleton variant="rounded" width={108} height={38} sx={{ borderRadius: 999, bgcolor: SK }} />
              <Skeleton variant="rounded" width={48} height={38} sx={{ borderRadius: 999, bgcolor: SK }} />
            </Stack>
          </Box>
        </Box>
      </Box>
      <Box sx={{ px: { xs: 1.5, md: 2 }, mt: 2 }}>
        <Skeleton variant="text" width="100%" sx={{ bgcolor: SK }} />
        <Skeleton variant="text" width="92%" sx={{ bgcolor: SK }} />
        <Skeleton variant="text" width="70%" sx={{ bgcolor: SK }} />
      </Box>
      <RowSkeleton />
    </Box>
  );
}

// 排行榜骨架：toggles 胶囊 + 榜首大图 + 领奖台 + 榜单行，贴合 rank
export function RankSkeleton() {
  return (
    <Box sx={{ pt: 1.5 }}>
      <Stack direction="row" spacing={1} sx={{ px: { xs: 1.5, md: 2 }, mb: 1.5 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={i === 0 ? 64 : 52} height={30} sx={{ borderRadius: 999, bgcolor: SK }} />
        ))}
      </Stack>
      <Skeleton
        variant="rounded"
        animation="wave"
        sx={{ mx: { xs: 1.5, md: 2 }, borderRadius: "16px", aspectRatio: { xs: "16 / 9", md: "5 / 2" }, bgcolor: SK }}
      />
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(4, 1fr)" },
          gap: { xs: 1.5, md: 2 },
          px: { xs: 1.5, md: 2 },
          mt: 2,
        }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Box key={i} sx={{ display: i >= 2 ? { xs: "none", md: "block" } : "block" }}>
            <PosterSkeleton />
          </Box>
        ))}
      </Box>
      <Stack sx={{ px: { xs: 1.5, md: 2 }, mt: 2, gap: 1 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Stack key={i} direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            <Skeleton variant="text" width={18} sx={{ bgcolor: SK }} />
            <Skeleton variant="rounded" width={44} height={60} sx={{ borderRadius: 1, bgcolor: SK }} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" width="55%" sx={{ bgcolor: SK }} />
              <Skeleton variant="text" width="35%" sx={{ bgcolor: SK }} />
            </Box>
          </Stack>
        ))}
      </Stack>
    </Box>
  );
}
