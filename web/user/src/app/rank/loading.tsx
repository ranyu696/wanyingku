// 流式：服务端取榜单期间先显排行榜骨架（toggles + hero + 领奖台 + 榜单行）。
import { RankSkeleton } from "@/components/State";

export default function Loading() {
  return <RankSkeleton />;
}
