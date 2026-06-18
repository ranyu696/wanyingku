import { useState } from "react";
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
} from "@mui/material";
import { useSourceOps, useSources } from "../api/hooks";
import type { Source } from "../api/types";
import PageHeader from "../components/PageHeader";
import TableSkeleton from "../components/TableSkeleton";

const emptyForm = { name: "", api_url: "", weight: 0, sync_interval_min: 720 };

export default function Sources() {
  const sources = useSources();
  const ops = useSourceOps();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Source | null>(null);
  const [form, setForm] = useState(emptyForm);

  const refresh = () => void sources.send();
  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (s: Source) => {
    setEditing(s);
    setForm({ name: s.name, api_url: s.api_url, weight: s.weight, sync_interval_min: s.sync_interval_min });
    setOpen(true);
  };
  const save = async () => {
    try {
      if (editing) {
        await ops.update.send({ id: editing.id, data: form });
      } else {
        await ops.create.send({ ...form, enabled: true });
      }
      setOpen(false);
      refresh();
    } catch {
      /* ignore */
    }
  };
  const toggle = async (s: Source) => {
    try {
      await ops.update.send({ id: s.id, data: { enabled: !s.enabled } });
      refresh();
    } catch {
      /* ignore */
    }
  };
  const del = async (s: Source) => {
    try {
      await ops.remove.send(s.id);
      refresh();
    } catch {
      /* ignore */
    }
  };
  const sync = async (s: Source, full: boolean) => {
    try {
      await ops.sync.send({ id: s.id, full });
    } catch {
      /* ignore */
    }
  };

  const list = sources.data ?? [];
  return (
    <Box>
      <PageHeader
        title="采集源"
        action={
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" onClick={() => void ops.syncAll.send(false)}>
              全部增量采集
            </Button>
            <Button variant="contained" onClick={openNew}>
              新增源
            </Button>
          </Stack>
        }
      />
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>ID</TableCell>
            <TableCell>名称</TableCell>
            <TableCell>接口</TableCell>
            <TableCell>权重</TableCell>
            <TableCell>启用</TableCell>
            <TableCell>上次采集</TableCell>
            <TableCell align="right">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {sources.loading && list.length === 0 && <TableSkeleton cols={7} />}
          {list.map((s) => (
            <TableRow key={s.id}>
              <TableCell>{s.id}</TableCell>
              <TableCell>{s.name}</TableCell>
              <TableCell
                sx={{ maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {s.api_url}
              </TableCell>
              <TableCell>{s.weight}</TableCell>
              <TableCell>
                <Switch size="small" checked={s.enabled} onChange={() => void toggle(s)} />
              </TableCell>
              <TableCell>{s.last_sync_at ? new Date(s.last_sync_at).toLocaleString() : "-"}</TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => void sync(s, false)}>
                  采集
                </Button>
                <Button size="small" onClick={() => void sync(s, true)}>
                  全量
                </Button>
                <Button size="small" onClick={() => openEdit(s)}>
                  编辑
                </Button>
                <Button size="small" color="error" onClick={() => void del(s)}>
                  删
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>{editing ? "编辑采集源" : "新增采集源"}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="名称"
            margin="dense"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            fullWidth
            label="接口地址（…/api.php/provide/vod/at/json/）"
            margin="dense"
            value={form.api_url}
            onChange={(e) => setForm({ ...form, api_url: e.target.value })}
          />
          <TextField
            fullWidth
            label="权重（越大越靠前）"
            type="number"
            margin="dense"
            value={form.weight}
            onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
          />
          <TextField
            fullWidth
            label="采集间隔（分钟）"
            type="number"
            margin="dense"
            value={form.sync_interval_min}
            onChange={(e) => setForm({ ...form, sync_interval_min: Number(e.target.value) })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={() => void save()}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
