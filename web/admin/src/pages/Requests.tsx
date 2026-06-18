import { useState } from "react";
import {
  Box,
  Button,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from "@mui/material";
import { useAdminRequests, useUpdateRequest } from "../api/hooks";
import { KIND_LABELS, REQ_STATUS } from "../api/types";
import PageHeader from "../components/PageHeader";
import TableSkeleton from "../components/TableSkeleton";

export default function Requests() {
  const [status, setStatus] = useState(-1);
  const reqs = useAdminRequests(status, 1);
  const upd = useUpdateRequest();

  const setStatusOf = async (id: number, s: number) => {
    try {
      await upd.send({ id, status: s });
      void reqs.send();
    } catch {
      /* ignore */
    }
  };

  const list = reqs.data?.list ?? [];
  return (
    <Box>
      <PageHeader
        title="求片"
        action={
          <Select size="small" value={status} onChange={(e) => setStatus(Number(e.target.value))}>
            <MenuItem value={-1}>全部</MenuItem>
            <MenuItem value={0}>待处理</MenuItem>
            <MenuItem value={1}>处理中</MenuItem>
            <MenuItem value={2}>已满足</MenuItem>
            <MenuItem value={3}>已拒绝</MenuItem>
          </Select>
        }
      />
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>片名</TableCell>
            <TableCell>年份</TableCell>
            <TableCell>类型</TableCell>
            <TableCell>同求</TableCell>
            <TableCell>状态</TableCell>
            <TableCell align="right">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {reqs.loading && list.length === 0 && <TableSkeleton cols={7} />}
          {list.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.id}</TableCell>
              <TableCell>{r.name}</TableCell>
              <TableCell>{r.year || "-"}</TableCell>
              <TableCell>{r.kind ? KIND_LABELS[r.kind] : "-"}</TableCell>
              <TableCell>{r.vote_count}</TableCell>
              <TableCell>{REQ_STATUS[r.status]}</TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => void setStatusOf(r.id, 1)}>
                  处理中
                </Button>
                <Button size="small" color="success" onClick={() => void setStatusOf(r.id, 2)}>
                  已满足
                </Button>
                <Button size="small" color="error" onClick={() => void setStatusOf(r.id, 3)}>
                  拒绝
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
}
