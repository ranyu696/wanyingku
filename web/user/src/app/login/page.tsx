"use client";
import { useState } from "react";
import { Box, Button, Tab, Tabs, TextField, Typography } from "@mui/material";
import { useRouter } from "next/navigation";
import { useLogin, useRegister } from "@/lib/hooks";
import { useAuth } from "@/store/auth";

export default function LoginPage() {
  const [tab, setTab] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [err, setErr] = useState("");
  const login = useLogin();
  const register = useRegister();
  const setAuth = useAuth((s) => s.setAuth);
  const router = useRouter();

  const submit = async () => {
    setErr("");
    try {
      const res =
        tab === 0
          ? await login.send({ username, password })
          : await register.send({ username, password, nickname });
      setAuth(res.token, res.user);
      router.push("/mine");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "操作失败");
    }
  };

  return (
    <Box sx={{ px: 3, pt: 5, maxWidth: 420, mx: "auto" }}>
      <Typography variant="h4" sx={{ fontWeight: 800, mb: 3, textAlign: "center" }}>
        <span style={{ color: "#ff4d5e" }}>影</span>视
      </Typography>
      <Tabs value={tab} onChange={(_e, v) => setTab(v)} variant="fullWidth" sx={{ mb: 2 }}>
        <Tab label="登录" />
        <Tab label="注册" />
      </Tabs>
      <TextField
        fullWidth
        label="用户名"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        margin="dense"
      />
      <TextField
        fullWidth
        label="密码"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        margin="dense"
      />
      {tab === 1 ? (
        <TextField
          fullWidth
          label="昵称（可选）"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          margin="dense"
        />
      ) : null}
      {err ? (
        <Typography color="error" variant="body2" sx={{ mt: 1 }}>
          {err}
        </Typography>
      ) : null}
      <Button
        fullWidth
        variant="contained"
        size="large"
        sx={{ mt: 3 }}
        onClick={() => void submit()}
        disabled={login.loading || register.loading}
      >
        {tab === 0 ? "登录" : "注册并登录"}
      </Button>
    </Box>
  );
}
