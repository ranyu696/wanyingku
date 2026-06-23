"use client";
import { Box, Chip, Stack } from "@mui/material";
import { useRouter } from "next/navigation";
import { KIND_LABELS } from "@/lib/types";

const boards = [
  { key: "popular", label: "热门榜", emoji: "🔥" },
  { key: "rating", label: "高分榜", emoji: "⭐" },
  { key: "like", label: "点赞榜", emoji: "👍" },
  { key: "latest", label: "近期更新", emoji: "🆕" },
];
const kinds = [0, 1, 2, 4, 3, 6];

// 排行榜切换：榜单/类型变化都改 URL searchParams，由服务端重新取数渲染。
export default function RankToggles({ sort, kind }: { sort: string; kind: number }) {
  const router = useRouter();
  const go = (nextSort: string, nextKind: number) =>
    router.push(`/rank?sort=${nextSort}&kind=${nextKind}`);

  return (
    <>
      <Stack
        direction="row"
        spacing={1}
        sx={{ px: { xs: 1.5, md: 2 }, pb: 1, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" } }}
      >
        {boards.map((b) => {
          const active = sort === b.key;
          return (
            <Box
              key={b.key}
              onClick={() => go(b.key, kind)}
              sx={{
                flexShrink: 0,
                px: 2,
                py: 1,
                borderRadius: "12px",
                cursor: "pointer",
                fontWeight: 700,
                border: "1px solid",
                borderColor: active ? "transparent" : "divider",
                color: active ? "#fff" : "text.secondary",
                background: active ? "linear-gradient(135deg,#ff3d5a,#ff8a3d)" : "transparent",
                boxShadow: active ? "0 6px 18px rgba(255,61,90,.35)" : "none",
                transition: "all .2s",
              }}
            >
              {b.emoji} {b.label}
            </Box>
          );
        })}
      </Stack>

      <Stack
        direction="row"
        spacing={0.8}
        sx={{ px: { xs: 1.5, md: 2 }, pb: 1.5, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" } }}
      >
        {kinds.map((k) => (
          <Chip
            key={k}
            size="small"
            label={k === 0 ? "全部" : KIND_LABELS[k]}
            variant={kind === k ? "filled" : "outlined"}
            onClick={() => go(sort, k)}
          />
        ))}
      </Stack>
    </>
  );
}
