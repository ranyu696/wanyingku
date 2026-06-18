import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  MenuItem,
  Select,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useSourceItems, useSources } from "../api/hooks";
import PageHeader from "../components/PageHeader";
import TableSkeleton from "../components/TableSkeleton";

export default function SourceItems() {
  const [q, setQ] = useState("");
  const [sourceId, setSourceId] = useState(0);
  const [page, setPage] = useState(1);
  const sources = useSources();
  const items = useSourceItems({ q, source_id: sourceId, page });

  const list = items.data?.list ?? [];
  const total = items.data?.total ?? 0;
  const size = items.data?.size ?? 30;
  const pages = Math.max(1, Math.ceil(total / size));
  const srcName = (id: number) => sources.data?.find((s) => s.id === id)?.name ?? String(id);

  return (
    <Box>
      <PageHeader title={`采集记录（${total}）`} />
      <Stack direction="row" spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="搜索片名"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Select
          size="small"
          value={sourceId}
          onChange={(e) => {
            setSourceId(Number(e.target.value));
            setPage(1);
          }}
        >
          <MenuItem value={0}>全部源</MenuItem>
          {(sources.data ?? []).map((s) => (
            <MenuItem key={s.id} value={s.id}>
              {s.name}
            </MenuItem>
          ))}
        </Select>
      </Stack>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>源</TableCell>
            <TableCell>名称</TableCell>
            <TableCell>年份</TableCell>
            <TableCell>备注</TableCell>
            <TableCell>归类作品</TableCell>
            <TableCell>复核</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {items.loading && list.length === 0 && <TableSkeleton cols={7} />}
          {list.map((it) => (
            <TableRow key={it.id}>
              <TableCell>{it.id}</TableCell>
              <TableCell>{srcName(it.source_id)}</TableCell>
              <TableCell>{it.name}</TableCell>
              <TableCell>{it.year || "-"}</TableCell>
              <TableCell>{it.remarks}</TableCell>
              <TableCell>{it.title_id ?? "-"}</TableCell>
              <TableCell>
                {it.needs_review ? <Chip size="small" color="warning" label="待复核" /> : "-"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <Stack direction="row" spacing={2} sx={{ mt: 2, justifyContent: "center", alignItems: "center" }}>
        <Button size="small" disabled={page <= 1} onClick={() => setPage(page - 1)}>
          上一页
        </Button>
        <Typography variant="body2">
          {page} / {pages}
        </Typography>
        <Button size="small" disabled={page >= pages} onClick={() => setPage(page + 1)}>
          下一页
        </Button>
      </Stack>
    </Box>
  );
}
