// 流式：服务端取详情期间先显详情骨架（hero 海报+信息 + 简介 + 相关横排）。
import { DetailSkeleton } from "@/components/State";

export default function Loading() {
  return <DetailSkeleton />;
}
