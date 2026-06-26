import type { Metadata } from "next";
import { Suspense } from "react";
import { BRAND } from "@/lib/site";
import SearchView from "@/components/SearchView";

// canonical 收敛到 /search：站内搜索的各 ?q= 变体不当作重复内容索引
export const metadata: Metadata = {
  title: `影视搜索 - ${BRAND}`,
  alternates: { canonical: "/search" },
};

export default function SearchPage() {
  // SearchView 用 useSearchParams() 读地址栏 → 必须套 Suspense 边界
  return (
    <Suspense fallback={null}>
      <SearchView />
    </Suspense>
  );
}
