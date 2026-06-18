import {
  AppBar,
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import { House, LayoutGrid, LogIn, Search, Trophy, User } from "lucide-react";
import { Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "../store/auth";

// 主导航（始终显示）；账户入口（我的/登录）单独放右侧，随登录态切换
const mainNavs = [
  { label: "首页", icon: <House size={20} />, path: "/" },
  { label: "分类", icon: <LayoutGrid size={20} />, path: "/category" },
  { label: "排行", icon: <Trophy size={20} />, path: "/rank" },
  { label: "搜索", icon: <Search size={20} />, path: "/search" },
] as const;

// 内容统一最大宽度（桌面居中限宽，避免大屏拉太宽）
const MAXW = 1320;

function isActive(pathname: string, path: string): boolean {
  return path === "/" ? pathname === "/" : pathname.startsWith(path);
}

export default function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const nav = useNavigate();
  const { token: realToken } = useAuth();
  // SSR 守卫：服务端拿不到 localStorage 永远是「未登录」，首帧客户端也按未登录渲染以匹配服务端，
  // 挂载后再切到真实登录态——否则已登录用户首屏会「我的 vs 登录」不一致，触发水合报错。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const token = mounted ? realToken : null;

  // 账户入口：登录后「我的」，未登录「登录」（放右侧）
  const account = token
    ? { label: "我的", icon: <User size={20} />, path: "/mine" as const }
    : { label: "登录", icon: <LogIn size={20} />, path: "/login" as const };
  const tabs = [...mainNavs, account];
  const current = tabs.findIndex((n) => isActive(pathname, n.path));

  return (
    <Box sx={{ minHeight: "100dvh" }}>
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
        <Toolbar sx={{ maxWidth: MAXW, mx: "auto", width: "100%", minHeight: { xs: 52, md: 60 } }}>
          <Typography
            variant="h6"
            onClick={() => nav({ to: "/" })}
            sx={{ fontWeight: 800, letterSpacing: 1, cursor: "pointer", userSelect: "none" }}
          >
            <span style={{ color: "#ff4d5e" }}>万</span>影库
          </Typography>

          {/* 桌面：主导航 */}
          <Stack direction="row" spacing={0.5} sx={{ ml: 4, display: { xs: "none", md: "flex" } }}>
            {mainNavs.map((n) => {
              const on = isActive(pathname, n.path);
              return (
                <Button
                  key={n.path}
                  startIcon={n.icon}
                  color={on ? "primary" : "inherit"}
                  onClick={() => nav({ to: n.path })}
                  sx={{ fontWeight: on ? 700 : 500 }}
                >
                  {n.label}
                </Button>
              );
            })}
          </Stack>

          <Box sx={{ flexGrow: 1 }} />

          {/* 右侧账户入口 */}
          {token ? (
            <Button
              startIcon={<User size={20} />}
              color={isActive(pathname, "/mine") ? "primary" : "inherit"}
              onClick={() => nav({ to: "/mine" })}
              sx={{ display: { xs: "none", md: "inline-flex" } }}
            >
              我的
            </Button>
          ) : (
            <Button
              variant="contained"
              size="small"
              startIcon={<LogIn size={18} />}
              onClick={() => nav({ to: "/login" })}
            >
              登录 / 注册
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Box
        component="main"
        sx={{
          maxWidth: MAXW,
          mx: "auto",
          width: "100%",
          pb: { xs: 8, md: 5 }, // 手机/平板竖屏给底部导航留空间
        }}
      >
        <Outlet />
      </Box>

      {/* 手机 / 平板竖屏：底部 Tab（账户位随登录态显示 我的 / 登录） */}
      <BottomNavigation
        showLabels
        value={current < 0 ? 0 : current}
        onChange={(_e, i) => nav({ to: tabs[i].path })}
        sx={{
          display: { xs: "flex", md: "none" },
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 1100,
          borderTop: "1px solid rgba(255,255,255,.08)",
          bgcolor: "rgba(16,16,25,.96)",
          backdropFilter: "blur(12px)",
        }}
      >
        {tabs.map((n) => (
          <BottomNavigationAction key={n.path} label={n.label} icon={n.icon} />
        ))}
      </BottomNavigation>
    </Box>
  );
}
