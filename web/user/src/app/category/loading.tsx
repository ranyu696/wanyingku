// 流式：服务端取数期间先显筛选条 + 网格骨架（与 CategoryFilters 对齐，避免数据到位时下移）。
import { CategorySkeleton } from "@/components/State";

export default function Loading() {
  return <CategorySkeleton />;
}
