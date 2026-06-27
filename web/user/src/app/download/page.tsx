import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { Download, MonitorPlay, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { BRAND } from "@/lib/site";

export const metadata: Metadata = {
  title: `下载客户端 - ${BRAND}`,
  description: `下载 ${BRAND} Android TV 版与手机版 APK，多线路高清在线观看。`,
};

const REPO = "https://github.com/ranyu696/wanyingku";
// 固定文件名 + latest 永久链：每次发版自动指向最新 Release，无需改前端。
const APPS = [
  {
    key: "tv",
    name: `${BRAND} TV 版`,
    desc: "Android TV / 电视盒子专用，遥控器操作、4K 大屏沉浸观看。",
    icon: <MonitorPlay size={32} />,
    href: `${REPO}/releases/latest/download/wanyingku-tv.apk`,
    tip: "电视端可用浏览器输入下载地址，或用 U 盘拷入后用「文件管理器」安装。",
  },
  {
    key: "phone",
    name: `${BRAND} 手机版`,
    desc: "Android 手机 / 平板，支持投屏、后台播放、消息推送。",
    icon: <Smartphone size={32} />,
    href: `${REPO}/releases/latest/download/wanyingku.apk`,
    tip: "首次安装需在系统设置中允许「安装未知来源应用」。",
  },
] as const;

export default function DownloadPage() {
  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, py: { xs: 2, md: 4 } }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 0.5 }}>
        下载客户端
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        iOS 暂未上架，Android 用户可直接下载 APK 安装。下载链接始终指向最新版本。
      </Typography>

      <Stack
        direction={{ xs: "column", sm: "row" }}
        spacing={2}
        sx={{ alignItems: "stretch", flexWrap: "wrap" }}
      >
        {APPS.map((app) => (
          <Card
            key={app.key}
            variant="outlined"
            sx={{ flex: 1, minWidth: { sm: 280 }, bgcolor: "rgba(255,255,255,.03)" }}
          >
            <CardContent>
              <Stack direction="row" spacing={1.5} sx={{ alignItems: "center", mb: 1 }}>
                <Box sx={{ color: "primary.main" }}>{app.icon}</Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {app.name}
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2, minHeight: 40 }}>
                {app.desc}
              </Typography>
              <Button
                fullWidth
                variant="contained"
                size="large"
                startIcon={<Download size={20} />}
                component="a"
                href={app.href}
                rel="noopener"
              >
                下载 APK
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.5 }}>
                {app.tip}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3 }}>
        历史版本与更新日志见{" "}
        <Box
          component="a"
          href={`${REPO}/releases`}
          target="_blank"
          rel="noopener"
          sx={{ color: "primary.main", textDecoration: "none" }}
        >
          GitHub Releases
        </Box>
        。
      </Typography>
    </Box>
  );
}
