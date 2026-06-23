"use client";
import { useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useComments, useCommentOps } from "@/lib/hooks";
import { useAuth } from "@/store/auth";

export default function Comments({ titleId }: { titleId: number }) {
  const { token } = useAuth();
  const router = useRouter();
  const c = useComments(titleId);
  const ops = useCommentOps();
  const [text, setText] = useState("");

  const list = c.data?.list ?? [];
  const total = c.data?.total ?? 0;

  const submit = async () => {
    if (!text.trim()) {
      return;
    }
    try {
      await ops.add.send({ title_id: titleId, content: text.trim() });
      setText("");
      void c.send();
    } catch {
      /* ignore */
    }
  };
  const like = async (id: number, on: boolean) => {
    try {
      await ops.like.send({ id, on });
      void c.send();
    } catch {
      /* ignore */
    }
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
        评论 {total > 0 ? `(${total})` : ""}
      </Typography>
      {token ? (
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="写条评论…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            multiline
            maxRows={4}
          />
          <Button variant="contained" onClick={() => void submit()} disabled={ops.add.loading}>
            发布
          </Button>
        </Stack>
      ) : (
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ mb: 2, alignItems: "center", flexWrap: "wrap", gap: 1 }}
        >
          <Typography variant="body2" color="text.secondary">
            登录后参与评论
          </Typography>
          <Button size="small" variant="contained" onClick={() => router.push("/login")}>
            登录 / 注册
          </Button>
        </Stack>
      )}
      <Stack spacing={2}>
        {list.map((cm) => (
          <Box key={cm.id}>
            <Stack direction="row" spacing={1.5}>
              <Avatar src={cm.user?.avatar} sx={{ width: 36, height: 36, bgcolor: "primary.main" }}>
                {(cm.user?.nickname || "U").slice(0, 1)}
              </Avatar>
              <Box sx={{ flex: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {cm.user?.nickname || "用户"}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ whiteSpace: "pre-wrap", mt: 0.3 }}
                >
                  {cm.content}
                </Typography>
                <Typography variant="caption" color="text.disabled">
                  {new Date(cm.created_at).toLocaleString()}
                </Typography>
              </Box>
              <Stack sx={{ alignItems: "center", minWidth: 36 }}>
                <IconButton
                  size="small"
                  color={cm.is_liked ? "primary" : "default"}
                  disabled={!token}
                  onClick={() => void like(cm.id, !cm.is_liked)}
                >
                  <ThumbsUp size={17} fill={cm.is_liked ? "currentColor" : "none"} />
                </IconButton>
                <Typography variant="caption" color="text.secondary">
                  {cm.like_count || 0}
                </Typography>
              </Stack>
            </Stack>
            <Divider sx={{ mt: 2 }} />
          </Box>
        ))}
        {list.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            还没有评论，来抢沙发～
          </Typography>
        ) : null}
      </Stack>
    </Box>
  );
}
