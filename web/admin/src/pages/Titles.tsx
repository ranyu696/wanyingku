import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
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
import { useAdminTitles, useTitleOps } from "../api/hooks";
import { KIND_LABELS, MATCH_LABELS, type Title } from "../api/types";
import PageHeader from "../components/PageHeader";
import TableSkeleton from "../components/TableSkeleton";

const kinds = [0, 1, 2, 3, 4, 5, 6];

export default function Titles() {
  const [q, setQ] = useState("");
  const [kind, setKind] = useState(0);
  const [status, setStatus] = useState(-1);
  const [page, setPage] = useState(1);
  const titles = useAdminTitles({ q, kind, status, page });
  const ops = useTitleOps();
  const [editing, setEditing] = useState<Title | null>(null);
  const [form, setForm] = useState<Record<string, unknown>>({});

  const refresh = () => void titles.send();
  const list = titles.data?.list ?? [];
  const total = titles.data?.total ?? 0;
  const size = titles.data?.size ?? 20;
  const pages = Math.max(1, Math.ceil(total / size));

  const openEdit = (t: Title) => {
    setEditing(t);
    setForm({
      name: t.name,
      original_name: t.original_name ?? "",
      year: t.year,
      kind: t.kind,
      overview: t.overview ?? "",
      poster: t.poster ?? "",
      status: t.status,
    });
  };
  const save = async () => {
    if (!editing) {
      return;
    }
    try {
      await ops.update.send({ id: editing.id, data: form });
      setEditing(null);
      refresh();
    } catch {
      /* ignore */
    }
  };
  const toggleStatus = async (t: Title) => {
    try {
      await ops.update.send({ id: t.id, data: { status: t.status === 1 ? 0 : 1 } });
      refresh();
    } catch {
      /* ignore */
    }
  };
  const del = async (t: Title) => {
    if (!window.confirm(`确认删除《${t.name}》？将级联删除其播放源与剧集。`)) {
      return;
    }
    try {
      await ops.remove.send(t.id);
      refresh();
    } catch {
      /* ignore */
    }
  };

  return (
    <Box>
      <PageHeader title={`作品管理（${total}）`} />
      <Stack direction="row" spacing={1.5} sx={{ mb: 2, flexWrap: "wrap", gap: 1 }}>
        <TextField
          size="small"
          placeholder="搜索片名/原名"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        <Select size="small" value={kind} onChange={(e) => { setKind(Number(e.target.value)); setPage(1); }}>
          {kinds.map((k) => (
            <MenuItem key={k} value={k}>
              {k === 0 ? "全部类型" : KIND_LABELS[k]}
            </MenuItem>
          ))}
        </Select>
        <Select size="small" value={status} onChange={(e) => { setStatus(Number(e.target.value)); setPage(1); }}>
          <MenuItem value={-1}>全部状态</MenuItem>
          <MenuItem value={1}>显示</MenuItem>
          <MenuItem value={0}>隐藏</MenuItem>
        </Select>
      </Stack>

      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>海报</TableCell>
            <TableCell>ID</TableCell>
            <TableCell>名称</TableCell>
            <TableCell>年份</TableCell>
            <TableCell>类型</TableCell>
            <TableCell>归类</TableCell>
            <TableCell>源</TableCell>
            <TableCell>状态</TableCell>
            <TableCell align="right">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {titles.loading && list.length === 0 && <TableSkeleton cols={9} />}
          {list.map((t) => (
            <TableRow key={t.id} sx={{ opacity: t.status === 1 ? 1 : 0.5 }}>
              <TableCell>
                {t.poster ? (
                  <Box
                    component="img"
                    src={t.poster}
                    sx={{ width: 36, height: 54, objectFit: "cover", borderRadius: 1, display: "block" }}
                  />
                ) : (
                  <Box sx={{ width: 36, height: 54, bgcolor: "#222", borderRadius: 1 }} />
                )}
              </TableCell>
              <TableCell>{t.id}</TableCell>
              <TableCell sx={{ maxWidth: 220 }}>
                <Typography variant="body2" noWrap>
                  {t.name}
                </Typography>
                {t.original_name ? (
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    {t.original_name}
                  </Typography>
                ) : null}
              </TableCell>
              <TableCell>{t.year || "-"}</TableCell>
              <TableCell>{KIND_LABELS[t.kind] ?? t.kind}</TableCell>
              <TableCell>
                <Chip
                  size="small"
                  label={MATCH_LABELS[t.match_status] ?? "?"}
                  color={t.tmdb_id ? "success" : "default"}
                  variant="outlined"
                />
              </TableCell>
              <TableCell>{t.source_count}</TableCell>
              <TableCell>{t.status === 1 ? "显示" : "隐藏"}</TableCell>
              <TableCell align="right">
                <Button size="small" onClick={() => openEdit(t)}>
                  编辑
                </Button>
                <Button size="small" onClick={() => void toggleStatus(t)}>
                  {t.status === 1 ? "隐藏" : "显示"}
                </Button>
                <Button size="small" color="error" onClick={() => void del(t)}>
                  删
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Stack direction="row" spacing={2} sx={{ mt: 2, alignItems: "center", justifyContent: "center" }}>
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

      <Dialog open={editing !== null} onClose={() => setEditing(null)} fullWidth maxWidth="sm">
        <DialogTitle>编辑作品 #{editing?.id}</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="名称"
            margin="dense"
            value={(form.name as string) ?? ""}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <TextField
            fullWidth
            label="原名"
            margin="dense"
            value={(form.original_name as string) ?? ""}
            onChange={(e) => setForm({ ...form, original_name: e.target.value })}
          />
          <Stack direction="row" spacing={2}>
            <TextField
              label="年份"
              type="number"
              margin="dense"
              value={(form.year as number) ?? 0}
              onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
            />
            <Select
              sx={{ mt: 1, minWidth: 120 }}
              size="small"
              value={(form.kind as number) ?? 1}
              onChange={(e) => setForm({ ...form, kind: Number(e.target.value) })}
            >
              {kinds.filter((k) => k > 0).map((k) => (
                <MenuItem key={k} value={k}>
                  {KIND_LABELS[k]}
                </MenuItem>
              ))}
            </Select>
            <Select
              sx={{ mt: 1, minWidth: 100 }}
              size="small"
              value={(form.status as number) ?? 1}
              onChange={(e) => setForm({ ...form, status: Number(e.target.value) })}
            >
              <MenuItem value={1}>显示</MenuItem>
              <MenuItem value={0}>隐藏</MenuItem>
            </Select>
          </Stack>
          <TextField
            fullWidth
            label="海报地址"
            margin="dense"
            value={(form.poster as string) ?? ""}
            onChange={(e) => setForm({ ...form, poster: e.target.value })}
          />
          <TextField
            fullWidth
            label="简介"
            margin="dense"
            multiline
            minRows={3}
            value={(form.overview as string) ?? ""}
            onChange={(e) => setForm({ ...form, overview: e.target.value })}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditing(null)}>取消</Button>
          <Button variant="contained" onClick={() => void save()}>
            保存
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
