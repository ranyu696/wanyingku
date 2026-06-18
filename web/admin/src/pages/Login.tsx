import { useState } from "react";
import { Box, Button, Paper, TextField, Typography } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import { useLogin } from "../api/hooks";
import { useAuth } from "../store/auth";

export default function Login() {
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const login = useLogin();
  const setToken = useAuth((s) => s.setToken);
  const nav = useNavigate();

  const submit = async () => {
    setErr("");
    try {
      const r = await login.send({ username: u, password: p });
      if (r.user.role !== 1) {
        setErr("该账号不是管理员");
        return;
      }
      setToken(r.token);
      void nav({ to: "/" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "登录失败");
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100dvh",
        alignItems: "center",
        justifyContent: "center",
        bgcolor: "#0c0c11",
      }}
    >
      <Paper sx={{ p: 4, width: 360 }}>
        <Typography variant="h6" sx={{ mb: 2, fontWeight: 800 }}>
          影视 · 管理后台
        </Typography>
        <TextField fullWidth label="用户名" margin="dense" value={u} onChange={(e) => setU(e.target.value)} />
        <TextField
          fullWidth
          label="密码"
          type="password"
          margin="dense"
          value={p}
          onChange={(e) => setP(e.target.value)}
        />
        {err ? (
          <Typography color="error" variant="body2" sx={{ mt: 1 }}>
            {err}
          </Typography>
        ) : null}
        <Button
          fullWidth
          variant="contained"
          sx={{ mt: 2 }}
          onClick={() => void submit()}
          disabled={login.loading}
        >
          登录
        </Button>
      </Paper>
    </Box>
  );
}
