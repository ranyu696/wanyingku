import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useUpdateUser, useUsers } from "../api/hooks";
import type { User } from "../api/types";
import PageHeader from "../components/PageHeader";
import TableSkeleton from "../components/TableSkeleton";

export default function Users() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const users = useUsers(q, page);
  const upd = useUpdateUser();

  const refresh = () => void users.send();
  const list = users.data?.list ?? [];
  const total = users.data?.total ?? 0;
  const size = users.data?.size ?? 20;
  const pages = Math.max(1, Math.ceil(total / size));

  const setRole = async (u: User, role: number) => {
    try {
      await upd.send({ id: u.id, role });
      refresh();
    } catch {
      /* ignore */
    }
  };
  const setStatus = async (u: User, status: number) => {
    try {
      await upd.send({ id: u.id, status });
      refresh();
    } catch {
      /* ignore */
    }
  };

  return (
    <Box>
      <PageHeader title={`用户管理（${total}）`} />
      <TextField
        size="small"
        placeholder="搜索用户名/昵称"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setPage(1);
        }}
        sx={{ mb: 2 }}
      />
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>用户名</TableCell>
            <TableCell>昵称</TableCell>
            <TableCell>角色</TableCell>
            <TableCell>状态</TableCell>
            <TableCell>注册</TableCell>
            <TableCell align="right">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {users.loading && list.length === 0 && <TableSkeleton cols={7} />}
          {list.map((u) => (
            <TableRow key={u.id}>
              <TableCell>{u.id}</TableCell>
              <TableCell>{u.username}</TableCell>
              <TableCell>{u.nickname}</TableCell>
              <TableCell>
                {u.role === 1 ? <Chip size="small" color="primary" label="管理员" /> : "用户"}
              </TableCell>
              <TableCell>{u.status === 1 ? "正常" : "禁用"}</TableCell>
              <TableCell>{new Date(u.created_at).toLocaleDateString()}</TableCell>
              <TableCell align="right">
                {u.role === 1 ? (
                  <Button size="small" onClick={() => void setRole(u, 0)}>
                    取消管理员
                  </Button>
                ) : (
                  <Button size="small" onClick={() => void setRole(u, 1)}>
                    设为管理员
                  </Button>
                )}
                {u.status === 1 ? (
                  <Button size="small" color="error" onClick={() => void setStatus(u, 0)}>
                    禁用
                  </Button>
                ) : (
                  <Button size="small" color="success" onClick={() => void setStatus(u, 1)}>
                    启用
                  </Button>
                )}
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
