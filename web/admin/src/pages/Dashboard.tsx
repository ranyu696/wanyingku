import { Box, Paper, Typography } from "@mui/material";
import { useStats } from "../api/hooks";
import { KIND_LABELS } from "../api/types";
import PageHeader from "../components/PageHeader";
import { Loading } from "../components/State";

function Card({ label, value }: { label: string; value: number | string }) {
  return (
    <Paper sx={{ p: 2, flex: "1 1 140px", minWidth: 140 }}>
      <Typography variant="h4" sx={{ fontWeight: 800 }}>
        {value}
      </Typography>
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Paper>
  );
}

export default function Dashboard() {
  const { data, loading } = useStats();
  if (loading || !data) {
    return <Loading />;
  }
  return (
    <Box>
      <PageHeader title="数据看板" />
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        <Card label="规范作品" value={data.titles} />
        <Card label="采集源" value={data.sources} />
        <Card label="采集记录" value={data.source_items} />
        <Card label="待复核" value={data.needs_review} />
        <Card label="待处理求片" value={data.requests_pending} />
      </Box>
      <Typography variant="subtitle1" sx={{ mt: 3, mb: 1 }}>
        按类型分布
      </Typography>
      <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap" }}>
        {(data.by_kind ?? []).map((k) => (
          <Card key={k.kind} label={KIND_LABELS[k.kind] || `类型${k.kind}`} value={k.count} />
        ))}
      </Box>
    </Box>
  );
}
