import { Box, Typography } from "@mui/material";
import { useParams } from "@tanstack/react-router";
import { usePersonTitles } from "../api/hooks";
import PosterGrid from "../components/PosterGrid";
import { Empty, Loading } from "../components/State";
import { useSeo } from "../seo";

export default function Person() {
  const { name } = useParams({ from: "/person/$name" });
  const { data, loading } = usePersonTitles(name);
  useSeo(`${name} 参演的影视作品`);
  const list = data?.list ?? [];
  return (
    <Box sx={{ p: { xs: 1.5, md: 2 } }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        {name} · 作品（{data?.total ?? 0}）
      </Typography>
      {loading && list.length === 0 ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty text="暂无作品" />
      ) : (
        <PosterGrid items={list} />
      )}
    </Box>
  );
}
