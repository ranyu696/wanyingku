"use client";
import { type ReactNode } from "react";
import { Avatar, Box, Button, Divider, IconButton, Stack, Typography } from "@mui/material";
import { CheckCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useFavorites,
  useHistory,
  useNotifOps,
  useNotifications,
  useSubscriptions,
} from "@/lib/hooks";
import ContinueWatching from "@/components/ContinueWatching";
import PosterGrid from "@/components/PosterGrid";
import { Empty } from "@/components/State";
import { useAuth } from "@/store/auth";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, mt: 3 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      {children}
    </Box>
  );
}

export default function MinePage() {
  const { token, user, logout } = useAuth();
  const router = useRouter();
  const fav = useFavorites(Boolean(token));
  const hist = useHistory(Boolean(token));
  const subs = useSubscriptions(Boolean(token));
  const notif = useNotifications(Boolean(token));
  const notifOps = useNotifOps();

  if (!token) {
    return (
      <Box sx={{ px: 3, pt: 8, textAlign: "center" }}>
        <Typography variant="h6" sx={{ mb: 2 }}>
          登录后同步收藏、历史、订阅更新
        </Typography>
        <Button variant="contained" size="large" onClick={() => router.push("/login")}>
          登录 / 注册
        </Button>
      </Box>
    );
  }

  const markRead = async (id: number) => {
    try {
      await notifOps.markRead.send(id);
      void notif.send();
    } catch {
      /* ignore */
    }
  };
  const markAll = async () => {
    try {
      await notifOps.markAll.send();
      void notif.send();
    } catch {
      /* ignore */
    }
  };

  const favItems = (fav.data?.list ?? []).map((f) => f.title).filter(Boolean);
  const subItems = (subs.data?.list ?? []).map((s) => s.title).filter(Boolean);
  const notifList = notif.data?.list ?? [];
  const unread = notifList.filter((n) => !n.is_read).length;

  return (
    <Box sx={{ pb: 3 }}>
      <Stack direction="row" spacing={2} sx={{ alignItems: "center", p: { xs: 2, md: 2.5 } }}>
        <Avatar sx={{ bgcolor: "primary.main", width: 56, height: 56 }}>
          {(user?.nickname || user?.username || "U").slice(0, 1)}
        </Avatar>
        <Box sx={{ flex: 1 }}>
          <Typography variant="h6">{user?.nickname || user?.username}</Typography>
          <Typography variant="caption" color="text.secondary">
            未读通知 {unread}
          </Typography>
        </Box>
        <Button size="small" variant="outlined" onClick={() => router.push("/requests")}>
          求片
        </Button>
        <Button size="small" onClick={logout}>
          退出
        </Button>
      </Stack>

      <Divider />
      <Box>
        {hist.data && hist.data.list.length > 0 ? (
          <ContinueWatching items={hist.data.list} />
        ) : (
          <Section title="继续观看">
            <Empty text="还没有观看记录" />
          </Section>
        )}
      </Box>

      <Section title="我的订阅">
        {subItems.length > 0 ? <PosterGrid items={subItems} /> : <Empty text="还没有订阅追更" />}
      </Section>

      <Section title="我的收藏">
        {favItems.length > 0 ? <PosterGrid items={favItems} /> : <Empty text="还没有收藏" />}
      </Section>

      <Section title="通知">
        {notifList.length > 0 ? (
          <>
            {unread > 0 ? (
              <Button
                size="small"
                startIcon={<CheckCheck size={16} />}
                onClick={() => void markAll()}
                sx={{ mb: 1 }}
              >
                全部已读
              </Button>
            ) : null}
            <Stack divider={<Divider />} spacing={1}>
              {notifList.map((n) => (
                <Stack key={n.id} direction="row" spacing={1} sx={{ alignItems: "flex-start", py: 0.5 }}>
                  <Box sx={{ flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: n.is_read ? 400 : 700 }}>
                      {n.title}
                    </Typography>
                    {n.body ? (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                        {n.body}
                      </Typography>
                    ) : null}
                    <Typography variant="caption" color="text.disabled">
                      {new Date(n.created_at).toLocaleString()}
                    </Typography>
                  </Box>
                  {!n.is_read ? (
                    <IconButton size="small" onClick={() => void markRead(n.id)} title="标记已读">
                      <CheckCheck size={16} />
                    </IconButton>
                  ) : null}
                </Stack>
              ))}
            </Stack>
          </>
        ) : (
          <Empty text="暂无通知" />
        )}
      </Section>
    </Box>
  );
}
