import type { Metadata } from "next";
import { Box, Typography } from "@mui/material";
import { getPeople } from "@/lib/cached";
import { BRAND } from "@/lib/site";
import PosterGrid from "@/components/PosterGrid";
import { Empty } from "@/components/State";


type Params = { params: Promise<{ name: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { name } = await params;
  const n = decodeURIComponent(name);
  return { title: `${n} 参演的影视作品 - ${BRAND}` };
}

export default async function PersonPage({ params }: Params) {
  const { name } = await params;
  const n = decodeURIComponent(name);
  const data = await getPeople(n);
  const list = data?.list ?? [];
  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {n} · 作品（{data?.total ?? 0}）
      </Typography>
      {list.length === 0 ? <Empty text="暂无作品" /> : <PosterGrid items={list} />}
    </Box>
  );
}
