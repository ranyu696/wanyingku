import { useState } from "react";
import {
  Alert,
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import { useMergeTitles, useReview, useReviewKeep } from "../api/hooks";
import type { SourceItem } from "../api/types";
import PageHeader from "../components/PageHeader";
import TableSkeleton from "../components/TableSkeleton";

export default function Review() {
  const review = useReview(1);
  const merge = useMergeTitles();
  const keep = useReviewKeep();
  const [msg, setMsg] = useState("");
  const busy = merge.loading || keep.loading;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setMsg("");
    try {
      await fn();
      setMsg(ok);
      await review.send();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "操作失败");
    }
  };

  // 并入系统建议的候选（归类作品 → 候选）
  const doMergeCandidate = (it: SourceItem) => {
    if (!it.title_id || !it.candidate_id) return;
    if (!window.confirm(`把「${it.title_name}」(#${it.title_id}) 并入「${it.candidate_name}」(#${it.candidate_id})？\n合并不可逆。`)) return;
    void run(() => merge.send({ from_id: it.title_id!, to_id: it.candidate_id! }), `已将 #${it.title_id} 并入 #${it.candidate_id}`);
  };

  // 并入手动指定的目标作品 ID
  const doMergeManual = (it: SourceItem) => {
    if (!it.title_id) return;
    const v = window.prompt(`把「${it.title_name}」(#${it.title_id}) 并入到哪个作品ID？`);
    const to = Number(v);
    if (!to || to === it.title_id) return;
    if (!window.confirm(`把 #${it.title_id} 并入 #${to}？合并不可逆。`)) return;
    void run(() => merge.send({ from_id: it.title_id!, to_id: to }), `已将 #${it.title_id} 并入 #${to}`);
  };

  // 标为独立：清复核标记，移出队列
  const doKeep = (it: SourceItem) => {
    if (!it.title_id) return;
    void run(() => keep.send(it.title_id!), `已标为独立：#${it.title_id}`);
  };

  const list = review.data?.list ?? [];
  return (
    <Box>
      <PageHeader title="去重复核 / 人工合并" />
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        逐条人工处理：判断「归类作品」与「疑似重复候选」是否同一部 —— 是则「并入候选」或「并入指定ID」；不是则「标为独立」移出队列。
      </Typography>
      {msg ? (
        <Alert severity="info" sx={{ mb: 2 }} onClose={() => setMsg("")}>
          {msg}
        </Alert>
      ) : null}

      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        待复核采集记录（{review.data?.total ?? 0}）
      </Typography>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell>采集名称</TableCell>
            <TableCell>年份</TableCell>
            <TableCell>源类型</TableCell>
            <TableCell>归类作品</TableCell>
            <TableCell>疑似重复（候选）</TableCell>
            <TableCell align="right">操作</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {review.loading && list.length === 0 && <TableSkeleton cols={6} />}
          {list.map((it) => (
            <TableRow key={it.id}>
              <TableCell>{it.name}</TableCell>
              <TableCell>{it.year || "-"}</TableCell>
              <TableCell>{it.type_name}</TableCell>
              <TableCell>
                {it.title_name || "（未知）"}
                <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                  #{it.title_id ?? "-"}
                </Typography>
              </TableCell>
              <TableCell>
                {it.candidate_id ? (
                  <>
                    {it.candidate_name || "（未知）"}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 0.5 }}>
                      #{it.candidate_id} · {it.candidate_score?.toFixed(2)}
                    </Typography>
                  </>
                ) : (
                  <Typography variant="caption" color="text.secondary">
                    无候选
                  </Typography>
                )}
              </TableCell>
              <TableCell align="right">
                <Stack direction="row" spacing={0.5} sx={{ justifyContent: "flex-end" }}>
                  {it.candidate_id ? (
                    <Button size="small" color="warning" onClick={() => doMergeCandidate(it)} disabled={busy}>
                      并入候选
                    </Button>
                  ) : null}
                  <Button size="small" onClick={() => doMergeManual(it)} disabled={busy}>
                    并入指定
                  </Button>
                  <Button size="small" color="success" onClick={() => doKeep(it)} disabled={busy}>
                    标为独立
                  </Button>
                </Stack>
              </TableCell>
            </TableRow>
          ))}
          {!review.loading && list.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6}>
                <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
                  暂无待复核记录 🎉
                </Typography>
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </Box>
  );
}
