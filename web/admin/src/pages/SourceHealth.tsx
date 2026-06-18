import {
  Box,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { useSourceHealth } from "../api/hooks";
import PageHeader from "../components/PageHeader";
import TableSkeleton from "../components/TableSkeleton";

function fmtTime(s?: string) {
  if (!s) {
    return "—";
  }
  return new Date(s).toLocaleString("zh-CN", { hour12: false });
}

export default function SourceHealth() {
  const { data, loading } = useSourceHealth();
  const list = data ?? [];
  const totalAlive = list.reduce((a, s) => a + s.alive, 0);
  const totalDead = list.reduce((a, s) => a + s.dead, 0);

  return (
    <Box>
      <PageHeader
        title="采集源健康监控"
        subtitle={`共 ${list.length} 源 · 活 ${totalAlive} · 死 ${totalDead} 线路（每 6h 自动探活）`}
      />
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>源</TableCell>
            <TableCell>启用</TableCell>
            <TableCell align="right">线路</TableCell>
            <TableCell>活 / 死 / 未知</TableCell>
            <TableCell align="right">平均延迟</TableCell>
            <TableCell align="right">作品</TableCell>
            <TableCell>最近探活</TableCell>
            <TableCell>最近同步</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {loading && list.length === 0 && <TableSkeleton cols={8} />}
          {list.map((s) => {
            const deadRatio = s.lines > 0 ? s.dead / s.lines : 0;
            return (
              <TableRow
                key={s.id}
                sx={{ bgcolor: deadRatio > 0.5 ? "rgba(255,60,90,.08)" : undefined }}
              >
                <TableCell>{s.name}</TableCell>
                <TableCell>{s.enabled ? "✓" : "✕"}</TableCell>
                <TableCell align="right">{s.lines}</TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Chip size="small" color="success" label={s.alive} />
                    <Chip size="small" color="error" label={s.dead} />
                    <Chip size="small" label={s.unknown} />
                  </Stack>
                </TableCell>
                <TableCell align="right">{s.avg_latency ? `${s.avg_latency}ms` : "—"}</TableCell>
                <TableCell align="right">{s.titles}</TableCell>
                <TableCell>{fmtTime(s.last_checked)}</TableCell>
                <TableCell>{fmtTime(s.last_sync_at)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Box>
  );
}
