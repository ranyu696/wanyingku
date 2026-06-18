import { useEffect } from "react";
import { AppBar, Box, Button, Stack, Toolbar, Typography } from "@mui/material";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "../store/auth";

const navs = [
  { label: "看板", path: "/" },
  { label: "作品", path: "/titles" },
  { label: "采集源", path: "/sources" },
  { label: "源监控", path: "/source-health" },
  { label: "采集记录", path: "/items" },
  { label: "去重复核", path: "/review" },
  { label: "求片", path: "/requests" },
  { label: "用户", path: "/users" },
] as const;

export default function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const token = useAuth((s) => s.token);
  const logout = useAuth((s) => s.logout);
  const nav = useNavigate();

  useEffect(() => {
    if (!token && pathname !== "/login") {
      void nav({ to: "/login" });
    }
  }, [token, pathname, nav]);

  if (pathname === "/login") {
    return <Outlet />;
  }

  return (
    <Box sx={{ minHeight: "100dvh", bgcolor: "#08080c" }}>
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: "rgba(12,12,17,.8)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar variant="dense" sx={{ maxWidth: 1320, mx: "auto", width: "100%" }}>
          <Typography
            variant="h6"
            onClick={() => void nav({ to: "/" })}
            sx={{ fontWeight: 800, letterSpacing: 1, mr: 3, cursor: "pointer", userSelect: "none" }}
          >
            <span style={{ color: "#ff4d5e" }}>万</span>影库
            <Box component="span" sx={{ color: "text.secondary", fontWeight: 600, fontSize: 13, ml: 0.8 }}>
              后台
            </Box>
          </Typography>
          <Stack direction="row" spacing={0.5} sx={{ flex: 1, overflowX: "auto" }}>
            {navs.map((n) => (
              <Button
                key={n.path}
                onClick={() => void nav({ to: n.path })}
                size="small"
                color={pathname === n.path ? "primary" : "inherit"}
                sx={{ flexShrink: 0, fontWeight: pathname === n.path ? 700 : 500 }}
              >
                {n.label}
              </Button>
            ))}
          </Stack>
          <Button size="small" color="inherit" onClick={logout} sx={{ flexShrink: 0 }}>
            退出
          </Button>
        </Toolbar>
      </AppBar>
      <Box sx={{ p: { xs: 1.5, md: 2 }, maxWidth: 1320, mx: "auto" }}>
        <Outlet />
      </Box>
    </Box>
  );
}
