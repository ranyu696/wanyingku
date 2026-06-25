import type { MetadataRoute } from "next";
import { serverGetSafe } from "@/lib/api";
import { SITE_URL } from "@/lib/site";
import { sitemapChunks } from "@/lib/sitemap";

// 影片约 9 万 > sitemap 单文件 5 万上限 → 拆成多个 /sitemap/{id}.xml（robots 列全部分片）。
export const revalidate = 3600;

export async function generateSitemaps() {
  const chunks = await sitemapChunks();
  return Array.from({ length: chunks }, (_, id) => ({ id }));
}

export default async function sitemap({ id }: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const page = Number(await id) || 0;
  const entries: MetadataRoute.Sitemap = [];
  // 静态路由放进第 0 片
  if (page === 0) {
    for (const p of ["/", "/category", "/rank", "/requests"]) {
      entries.push({ url: `${SITE_URL}${p}` });
    }
  }
  const list =
    (await serverGetSafe<Array<{ id: number; slug?: string; updated_at?: string }>>(
      "/sitemap",
      { page },
      3600,
    )) ?? [];
  for (const t of list) {
    entries.push({
      url: `${SITE_URL}/title/${t.slug || t.id}`,
      lastModified: t.updated_at ? new Date(t.updated_at) : undefined,
    });
  }
  return entries;
}
