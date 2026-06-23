"use client";
import { useHistory } from "@/lib/hooks";
import { useAuth } from "@/store/auth";
import ContinueWatching from "./ContinueWatching";

// 首页「继续观看」客户端岛：登录后取历史（token 在 localStorage，服务端取不到）
export default function HomeContinue() {
  const { token } = useAuth();
  const hist = useHistory(Boolean(token));
  if (!token) {
    return null;
  }
  return <ContinueWatching items={hist.data?.list ?? []} />;
}
