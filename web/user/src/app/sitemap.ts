import type { MetadataRoute } from "next";
import { getSitemapPage } from "@/lib/cached";
import { SITE_URL } from "@/lib/site";
import { sitemapChunks } from "@/lib/sitemap";

// 影片十几万 > sitemap 单文件 5 万上限 → 拆成多个 /sitemap/{id}.xml（robots 列全部分片）。
// 分片数据用 use cache 缓存（每片 <2MB）：现取现拼要 2.8~5s、致 Google 抓取超时「无法抓取」；
// 缓存后秒出、且发 s-maxage 可被 CF 边缘缓存。

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
  const list = (await getSitemapPage(page)) ?? [];
  for (const t of list) {
    entries.push({
      url: `${SITE_URL}/title/${t.slug || t.id}`,
      lastModified: t.updated_at ? new Date(t.updated_at) : undefined,
    });
  }
  return entries;
}
