import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { sitemapChunks } from "@/lib/sitemap";

// 取代原 server.mjs 动态 robots：私密/播放页禁抓，列出全部 sitemap 分片（/sitemap/{id}.xml）。

export default async function robots(): Promise<MetadataRoute.Robots> {
  const chunks = await sitemapChunks();
  const sitemap = Array.from({ length: chunks }, (_, i) => `${SITE_URL}/sitemap/${i}.xml`);
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/mine", "/login", "/watch/"],
    },
    sitemap,
  };
}
