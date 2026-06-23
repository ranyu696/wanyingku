import type { Metadata } from "next";
import { BRAND } from "@/lib/site";
import RequestsView from "@/components/RequestsView";

export const metadata: Metadata = { title: `求片中心 - 想看的片告诉我们 - ${BRAND}` };

export default function RequestsPage() {
  return <RequestsView />;
}
