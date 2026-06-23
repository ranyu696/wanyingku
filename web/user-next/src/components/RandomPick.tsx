"use client";
import { Box, Button } from "@mui/material";
import { Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRandomTitle } from "@/lib/hooks";

// 「今天看点啥」：随机一部，跳到详情。
export default function RandomPick() {
  const rand = useRandomTitle();
  const router = useRouter();
  const go = async () => {
    try {
      const t = await rand.send({});
      if (t?.id) {
        router.push(`/title/${t.slug || t.id}`);
      }
    } catch {
      /* ignore */
    }
  };
  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, mt: 1.5 }}>
      <Button
        variant="outlined"
        startIcon={<Shuffle size={18} />}
        onClick={go}
        disabled={rand.loading}
        sx={{ borderRadius: 5 }}
      >
        {rand.loading ? "正在挑…" : "🎲 今天看点啥"}
      </Button>
    </Box>
  );
}
