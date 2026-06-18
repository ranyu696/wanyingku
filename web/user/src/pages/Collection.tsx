import { Box, Typography } from "@mui/material";
import { useParams } from "@tanstack/react-router";
import { useCollectionTitles } from "../api/hooks";
import PosterGrid from "../components/PosterGrid";
import { Empty, Loading } from "../components/State";
import { useSeo } from "../seo";

export default function Collection() {
  const { key } = useParams({ from: "/collection/$key" });
  const { data, loading } = useCollectionTitles(key);
  useSeo(data?.title, data?.desc);
  const list = data?.list ?? [];
  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h6">{data?.title ?? "专题"}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {data?.desc ?? ""}
        {data?.total ? `（${data.total}）` : ""}
      </Typography>
      {loading && list.length === 0 ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty text="暂无内容" />
      ) : (
        <PosterGrid items={list} />
      )}
    </Box>
  );
}
