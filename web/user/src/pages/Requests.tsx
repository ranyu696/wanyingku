import { useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import { Clapperboard, Plus, ThumbsUp } from "lucide-react";
import { useCreateRequest, useRequestsList, useRequestVote } from "../api/hooks";
import { KIND_LABELS, REQ_STATUS } from "../api/types";
import { Empty, Loading } from "../components/State";
import { useAuth } from "../store/auth";
import { useSeo } from "../seo";

const tabs: Array<[number, string]> = [
  [-1, "全部"],
  [0, "待处理"],
  [1, "处理中"],
  [2, "已满足"],
];

const statusColor: Record<number, "default" | "warning" | "info" | "success" | "error"> = {
  0: "warning",
  1: "info",
  2: "success",
  3: "error",
};

export default function Requests() {
  useSeo("求片中心 - 想看的片告诉我们");
  const { token } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState(-1);
  const reqs = useRequestsList(status);
  const vote = useRequestVote();
  const createReq = useCreateRequest();

  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  // 投票乐观覆盖：{id: {voted, count}}
  const [ov, setOv] = useState<Record<number, { voted: boolean; count: number }>>({});

  const list = reqs.data?.list ?? [];

  const requireLogin = () => {
    void navigate({ to: "/login" });
  };

  const onVote = async (id: number, curVoted: boolean, curCount: number) => {
    if (!token) {
      requireLogin();
      return;
    }
    const on = !curVoted;
    // 乐观更新
    setOv((m) => ({ ...m, [id]: { voted: on, count: curCount + (on ? 1 : -1) } }));
    try {
      const res = (await vote.send({ id, on })) as { vote_count: number; is_voted: boolean };
      setOv((m) => ({ ...m, [id]: { voted: res.is_voted, count: res.vote_count } }));
    } catch {
      setOv((m) => ({ ...m, [id]: { voted: curVoted, count: curCount } })); // 回滚
    }
  };

  const submit = async () => {
    const n = name.trim();
    if (!n) {
      return;
    }
    try {
      await createReq.send({ name: n, year: year ? Number(year) : undefined });
      setOpen(false);
      setName("");
      setYear("");
      setOv({});
      void reqs.send();
    } catch {
      /* ignore */
    }
  };

  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, pt: 1.5, pb: 2 }}>
      <Stack direction="row" sx={{ alignItems: "center", mb: 1.5 }}>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            求片广场
          </Typography>
          <Typography variant="caption" color="text.secondary">
            想看的没有？发起求片，大家一起顶，采集到自动通知你
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<Plus size={18} />}
          onClick={() => (token ? setOpen(true) : requireLogin())}
        >
          我要求片
        </Button>
      </Stack>

      <Stack direction="row" spacing={1} sx={{ mb: 2, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" } }}>
        {tabs.map(([v, l]) => (
          <Chip
            key={v}
            label={l}
            color={status === v ? "primary" : "default"}
            onClick={() => setStatus(v)}
          />
        ))}
      </Stack>

      {reqs.loading && list.length === 0 ? (
        <Loading />
      ) : list.length === 0 ? (
        <Empty text="还没有求片，来发起第一个吧" />
      ) : (
        <Stack spacing={1}>
          {list.map((r, i) => {
            const o = ov[r.id];
            const voted = o ? o.voted : Boolean(r.is_voted);
            const count = o ? o.count : r.vote_count;
            return (
              <Stack
                key={r.id}
                direction="row"
                spacing={1.5}
                sx={{
                  alignItems: "center",
                  p: 1.2,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,.04)",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography
                  sx={{
                    width: 24,
                    textAlign: "center",
                    fontWeight: 800,
                    color: i < 3 ? "primary.main" : "text.disabled",
                    flexShrink: 0,
                  }}
                >
                  {i + 1}
                </Typography>
                <Clapperboard size={18} style={{ opacity: 0.5, flexShrink: 0 }} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 600 }}>
                    {r.name}
                    {r.year ? (
                      <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.8 }}>
                        {r.year}
                      </Typography>
                    ) : null}
                  </Typography>
                  <Stack direction="row" spacing={0.8} sx={{ mt: 0.3, alignItems: "center" }}>
                    <Chip
                      size="small"
                      label={REQ_STATUS[r.status]}
                      color={statusColor[r.status]}
                      sx={{ height: 18, fontSize: 11 }}
                    />
                    {r.kind ? (
                      <Typography variant="caption" color="text.secondary">
                        {KIND_LABELS[r.kind]}
                      </Typography>
                    ) : null}
                  </Stack>
                </Box>
                <Button
                  size="small"
                  variant={voted ? "contained" : "outlined"}
                  color="primary"
                  onClick={() => void onVote(r.id, voted, count)}
                  sx={{ minWidth: 64, flexShrink: 0, borderRadius: 5 }}
                  startIcon={<ThumbsUp size={15} />}
                >
                  {count}
                </Button>
              </Stack>
            );
          })}
        </Stack>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>我要求片</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="片名"
            value={name}
            onChange={(e) => setName(e.target.value)}
            margin="dense"
          />
          <TextField
            fullWidth
            label="年份（可选）"
            value={year}
            onChange={(e) => setYear(e.target.value)}
            margin="dense"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>取消</Button>
          <Button variant="contained" onClick={() => void submit()} disabled={createReq.loading}>
            提交
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
