// SEO 辅助：JSON-LD 结构化数据 + 详情页 metadata 构造（移植自原 server.mjs resolveHead）。
import type { Metadata } from "next";
import type { TitleDetail } from "./types";
import { BRAND, DEF_DESC, KIND_LABEL, SITE_URL } from "./site";

export function splitNames(s?: string): string[] {
  return String(s || "")
    .split(/[,，、/]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function detailLd(d: TitleDetail, origin: string): Record<string, any> {
  const isSeries = d.kind !== 1;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const obj: Record<string, any> = {
    "@context": "https://schema.org",
    "@type": isSeries ? "TVSeries" : "Movie",
    name: d.name,
    url: `${origin}/title/${d.slug || d.id}`,
  };
  if (d.poster) {
    obj.image = d.poster;
  }
  if (d.overview) {
    obj.description = String(d.overview).replace(/\s+/g, " ").trim();
  }
  if (d.year) {
    obj.datePublished = String(d.year);
  }
  const genres = (d.genres || []).map((g) => g.name).filter(Boolean);
  if (genres.length) {
    obj.genre = genres;
  }
  const dirs = splitNames(d.director);
  if (dirs.length) {
    obj.director = dirs.map((n) => ({ "@type": "Person", name: n }));
  }
  const actors = splitNames(d.actors).slice(0, 10);
  if (actors.length) {
    obj.actor = actors.map((n) => ({ "@type": "Person", name: n }));
  }
  const rating = d.vote_average || d.douban_rating || 0;
  const count = d.vote_count || d.douban_votes || 0;
  if (rating > 0) {
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(rating).toFixed(1),
      bestRating: 10,
      ratingCount: count > 0 ? count : 1,
    };
  }
  if (isSeries && d.total_episodes > 0) {
    obj.numberOfEpisodes = d.total_episodes;
  }
  return obj;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function breadcrumbLd(d: TitleDetail, origin: string): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "首页", item: origin },
      {
        "@type": "ListItem",
        position: 2,
        name: KIND_LABEL[d.kind] || "影视",
        item: `${origin}/category?kind=${d.kind}`,
      },
      { "@type": "ListItem", position: 3, name: d.name },
    ],
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function websiteLd(origin: string): Record<string, any> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: BRAND,
    url: origin || "/",
    potentialAction: {
      "@type": "SearchAction",
      target: `${origin}/search?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };
}

// 详情页 metadata：标题/描述/og/canonical（canonical 用 slug，与 sitemap 一致）
export function detailMetadata(d: TitleDetail): Metadata {
  const title = `${d.name}${d.year ? ` (${d.year})` : ""} 在线观看 - ${BRAND}`;
  const desc = d.overview
    ? String(d.overview).replace(/\s+/g, " ").trim().slice(0, 150)
    : DEF_DESC;
  const canonical = `${SITE_URL}/title/${d.slug || d.id}`;
  return {
    title,
    description: desc,
    alternates: { canonical },
    openGraph: {
      siteName: BRAND,
      type: "video.other",
      title,
      description: desc,
      url: canonical,
      images: d.poster ? [d.poster] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: d.poster ? [d.poster] : undefined,
    },
  };
}
