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
  TextField,
  Typography,
} from "@mui/material";
import { useMergeTitles, useReview } from "../api/hooks";
import type { SourceItem } from "../api/types";
import PageHeader from "../components/PageHeader";
import TableSkeleton from "../components/TableSkeleton";

export default function Review() {
  const review = useReview(1);
  const merge = useMergeTitles();
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [msg, setMsg] = useState("");

  const doMerge = async () => {
    setMsg("");
    const f = Number(fromId);
    const t = Number(toId);
    if (!f || !t || f === t) {
      setMsg("请输入两个不同的作品 ID");
      return;
    }
    try {
      await merge.send({ from_id: f, to_id: t });
      setMsg(`已将作品 #${f} 合并进 #${t}`);
      setFromId("");
      setToId("");
      await review.send();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "合并失败");
    }
  };

  // 一键把复核作品并入系统建议的候选（方向：归类作品 → 候选）。逐条人工确认，不可逆。
  const doRowMerge = async (it: SourceItem) => {
    if (!it.title_id || !it.candidate_id) {
      return;
    }
    if (
      !window.confirm(
        `确认把「${it.title_name}」(#${it.title_id}) 并入「${it.candidate_name}」(#${it.candidate_id})？\n合并不可逆。`,
      )
    ) {
      return;
    }
    setMsg("");
    try {
      await merge.send({ from_id: it.title_id, to_id: it.candidate_id });
      setMsg(`已将 #${it.title_id} 并入 #${it.candidate_id}`);
      await review.send();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "合并失败");
    }
  };

  const list = review.data?.list ?? [];
  return (
    <Box>
      <PageHeader title="去重复核 / 人工合并" />
      <Box sx={{ p: 2, mb: 3, border: "1px solid rgba(255,255,255,.1)", borderRadius: 2 }}>
        <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
          把「源作品 from」合并进「目标作品 to」（解决同一部被误判成两条）
        </Typography>
        <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
          <TextField
            size="small"
            label="from 作品ID"
            value={fromId}
            onChange={(e) => setFromId(e.target.value)}
          />
          <TextField
            size="small"
            label="to 作品ID"
            value={toId}
            onChange={(e) => setToId(e.target.value)}
          />
          <Button variant="contained" onClick={() => void doMerge()} disabled={merge.loading}>
            合并
          </Button>
        </Stack>
        {msg ? (
          <Alert severity="info" sx={{ mt: 2 }}>
            {msg}
          </Alert>
        ) : null}
      </Box>

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
                {it.title_id && it.candidate_id ? (
                  <Button size="small" color="warning" onClick={() => void doRowMerge(it)} disabled={merge.loading}>
                    并入候选
                  </Button>
                ) : null}
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
