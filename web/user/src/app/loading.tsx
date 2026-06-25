// 首页流式：服务端取 /home 期间先秒显骨架（force-dynamic，取数可能慢）。
import { HomeSkeleton } from "@/components/State";

export default function Loading() {
  return <HomeSkeleton />;
}
