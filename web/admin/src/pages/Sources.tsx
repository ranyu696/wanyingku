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
  Tooltip,
} from "@mui/material";
import { useSourceOps, useSources } from "../api/hooks";
import type { Source } from "../api/types";
import PageHeader from "../components/PageHeader";
import TableSkeleton from "../components/TableSkeleton";
import { toast } from "../components/Toast";

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
  // 写操作只管成功提示；失败由 alova 全局 onError 统一弹错误。
  const save = async () => {
    try {
      if (editing) {
        await ops.update.send({ id: editing.id, data: form });
      } else {
        await ops.create.send({ ...form, enabled: true });
      }
      setOpen(false);
      refresh();
      toast.success(editing ? "已保存" : "已新增采集源");
    } catch {
      /* 全局已弹错误 */
    }
  };
  const toggle = async (s: Source) => {
    try {
      await ops.update.send({ id: s.id, data: { enabled: !s.enabled } });
      refresh();
      toast.success(s.enabled ? `已停用「${s.name}」` : `已启用「${s.name}」`);
    } catch {
      /* 全局已弹错误 */
    }
  };
  const del = async (s: Source) => {
    if (!window.confirm(`删除采集源「${s.name}」？仅删除源配置，不影响已采集的作品。`)) {
      return;
    }
    try {
      await ops.remove.send(s.id);
      refresh();
      toast.success("已删除");
    } catch {
      /* 全局已弹错误 */
    }
  };
  const sync = async (s: Source, full: boolean) => {
    if (full && !window.confirm(`全量采集「${s.name}」？将翻完全部页、耗时较长，后台进行。`)) {
      return;
    }
    try {
      await ops.sync.send({ id: s.id, full });
      toast.success(`已开始${full ? "全量" : "增量"}采集「${s.name}」，后台进行`);
    } catch {
      /* 全局已弹错误 */
    }
  };
  const syncAll = async () => {
    if (!window.confirm("对全部启用的源做增量采集？只拉各源最近更新，后台并发进行。")) {
      return;
    }
    try {
      await ops.syncAll.send(false);
      toast.success("已开始全部增量采集，后台并发进行");
    } catch {
      /* 全局已弹错误 */
    }
  };
  const reindex = async () => {
    if (!window.confirm("重建全部搜索索引？将索引约 9 万部，耗时几分钟、后台进行。")) {
      return;
    }
    try {
      await ops.reindex.send();
      toast.success("重建已在后台开始，几分钟后搜索覆盖全部影片");
    } catch {
      /* 全局已弹错误 */
    }
  };

  const list = sources.data ?? [];
  return (
    <Box>
      <PageHeader
        title="采集源"
        action={
          <Stack direction="row" spacing={1}>
            <Tooltip title="重建全部搜索索引，约 9 万部、后台进行">
              <Button
                variant="outlined"
                color="secondary"
                disabled={ops.reindex.loading}
                onClick={() => void reindex()}
              >
                {ops.reindex.loading ? "触发中…" : "重建索引"}
              </Button>
            </Tooltip>
            <Tooltip title="对所有启用的源拉取最近更新，后台并发进行">
              <Button
                variant="outlined"
                disabled={ops.syncAll.loading}
                onClick={() => void syncAll()}
              >
                {ops.syncAll.loading ? "触发中…" : "全部增量采集"}
              </Button>
            </Tooltip>
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
                <Tooltip title="只拉最近更新（快）">
                  <Button size="small" onClick={() => void sync(s, false)}>
                    增量
                  </Button>
                </Tooltip>
                <Tooltip title="翻完全部页、重采该源（慢，会二次确认）">
                  <Button size="small" onClick={() => void sync(s, true)}>
                    全量
                  </Button>
                </Tooltip>
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
