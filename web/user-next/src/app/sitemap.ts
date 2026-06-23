import type { MetadataRoute } from "next";
import { serverGetSafe } from "@/lib/api";
import { SITE_URL } from "@/lib/site";

// 取代原 server.mjs 动态 sitemap：静态路由 + 后端 /sitemap 的影片明细（slug + lastmod）
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = ["/", "/category", "/rank", "/requests"].map((p) => ({
    url: `${SITE_URL}${p}`,
  }));

  const list =
    (await serverGetSafe<Array<{ id: number; slug?: string; updated_at?: string }>>(
      "/sitemap",
      undefined,
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
