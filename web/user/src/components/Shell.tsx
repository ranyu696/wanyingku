"use client";
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
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/store/auth";

// 主导航（始终显示）；账户入口（我的/登录）单独放右侧，随登录态切换
const mainNavs = [
  { label: "首页", icon: <House size={20} />, path: "/" },
  { label: "分类", icon: <LayoutGrid size={20} />, path: "/category" },
  { label: "排行", icon: <Trophy size={20} />, path: "/rank" },
  { label: "搜索", icon: <Search size={20} />, path: "/search" },
] as const;

// 内容统一最大宽度（桌面居中限宽，避免大屏拉太宽）
const MAXW = 1320;

// 底部友情链接（外链，新标签打开；正经友链互换给 dofollow）
const FRIEND_LINKS = [
  { name: "好狗电影导航", url: "https://www.howgo.cc" },
  { name: "聚BT", url: "https://jubt13.xyz/cn/index.html" },
];

function isActive(pathname: string, path: string): boolean {
  return path === "/" ? pathname === "/" : pathname.startsWith(path);
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { token: realToken } = useAuth();
  // SSR 守卫：服务端拿不到 localStorage 永远是「未登录」，首帧客户端也按未登录渲染以匹配服务端，
  // 挂载后再切到真实登录态——否则已登录用户首屏会「我的 vs 登录」不一致，触发水合报错。
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const token = mounted ? realToken : null;

  // 播放页 /watch 是全屏沉浸式，不显示外层导航壳
  const bare = pathname.startsWith("/watch/");

  const account = token
    ? { label: "我的", icon: <User size={20} />, path: "/mine" as const }
    : { label: "登录", icon: <LogIn size={20} />, path: "/login" as const };
  const tabs = [...mainNavs, account];
  const current = tabs.findIndex((n) => isActive(pathname, n.path));

  // 播放页不显示导航壳，但仍套顶层最大宽度容器（桌面居中限宽，不满屏拉伸）。
  // 短剧的 9:16 沉浸流是 position:fixed 全屏浮层，自然不受此容器影响。
  if (bare) {
    return (
      <Box component="main" sx={{ maxWidth: MAXW, mx: "auto", width: "100%" }}>
        {children}
      </Box>
    );
  }

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
          <Box
            component="img"
            src="/logo.png"
            alt="万影库"
            onClick={() => router.push("/")}
            sx={{
              height: { xs: 28, md: 34 },
              width: "auto",
              display: "block",
              cursor: "pointer",
              userSelect: "none",
            }}
          />

          {/* 桌面：主导航 */}
          <Stack direction="row" spacing={0.5} sx={{ ml: 4, display: { xs: "none", md: "flex" } }}>
            {mainNavs.map((n) => {
              const on = isActive(pathname, n.path);
              return (
                <Button
                  key={n.path}
                  startIcon={n.icon}
                  color={on ? "primary" : "inherit"}
                  onClick={() => router.push(n.path)}
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
              onClick={() => router.push("/mine")}
              sx={{ display: { xs: "none", md: "inline-flex" } }}
            >
              我的
            </Button>
          ) : (
            <Button
              variant="contained"
              size="small"
              startIcon={<LogIn size={18} />}
              onClick={() => router.push("/login")}
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
        {children}

        {/* 友情链接 */}
        <Box
          component="footer"
          sx={{
            mt: 4,
            pt: 2.5,
            px: { xs: 1.5, md: 2 },
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack direction="row" sx={{ flexWrap: "wrap", alignItems: "center", gap: 1.5, rowGap: 1 }}>
            <Typography variant="caption" color="text.secondary">
              友情链接
            </Typography>
            {FRIEND_LINKS.map((l) => (
              <Typography
                key={l.url}
                component="a"
                href={l.url}
                target="_blank"
                rel="noopener"
                variant="caption"
                sx={{
                  color: "text.secondary",
                  textDecoration: "none",
                  "&:hover": { color: "primary.main" },
                }}
              >
                {l.name}
              </Typography>
            ))}
          </Stack>
        </Box>
      </Box>

      {/* 手机 / 平板竖屏：底部 Tab（账户位随登录态显示 我的 / 登录） */}
      <BottomNavigation
        showLabels
        value={current < 0 ? 0 : current}
        onChange={(_e, i) => router.push(tabs[i].path)}
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
