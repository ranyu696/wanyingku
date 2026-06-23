import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

// 取代原 server.mjs 动态 robots：私密/播放页禁抓，指向 sitemap
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/mine", "/login", "/watch/"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
