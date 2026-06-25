import type { Metadata } from "next";
import { Box, Typography } from "@mui/material";
import { getCollection } from "@/lib/cached";
import { BRAND } from "@/lib/site";
import type { Title } from "@/lib/types";
import PosterGrid from "@/components/PosterGrid";
import { Empty } from "@/components/State";


interface CollectionData {
  title: string;
  desc: string;
  list: Title[];
  total: number;
}

type Params = { params: Promise<{ key: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { key } = await params;
  const data = await getCollection(key);
  return {
    title: `${data?.title ?? "专题"} - ${BRAND}`,
    description: data?.desc || undefined,
  };
}

export default async function CollectionPage({ params }: Params) {
  const { key } = await params;
  const data = await getCollection(key);
  const list = data?.list ?? [];
  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h6">{data?.title ?? "专题"}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {data?.desc ?? ""}
        {data?.total ? `（${data.total}）` : ""}
      </Typography>
      {list.length === 0 ? <Empty text="暂无内容" /> : <PosterGrid items={list} />}
    </Box>
  );
}
