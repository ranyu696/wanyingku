import type { Metadata } from "next";
import { BRAND } from "@/lib/site";
import SearchView from "@/components/SearchView";

export const metadata: Metadata = { title: `影视搜索 - ${BRAND}` };

export default function SearchPage() {
  return <SearchView />;
}
