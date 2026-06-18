import { useEffect } from "react";

const BRAND = "万影库";
const DEFAULT_TITLE = `${BRAND} - 海量影视聚合，免费在线观看`;

function upsertMeta(key: string, content: string, property = false) {
  if (!content) {
    return;
  }
  const attr = property ? "property" : "name";
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// 按页面设置 SEO 标题/描述（影响 Google「标题链接」）。
// title 传该页主标题，自动拼「 - 万影库」品牌后缀（用竖线/连字符分隔，品牌放末尾）；
// 不传则回落到站点默认标题。description 用于 meta description / og:description。
export function useSeo(title?: string, description?: string) {
  useEffect(() => {
    const full = title ? `${title} - ${BRAND}` : DEFAULT_TITLE;
    document.title = full;
    upsertMeta("og:title", full, true);
    if (description) {
      const d = description.replace(/\s+/g, " ").trim().slice(0, 150);
      upsertMeta("description", d);
      upsertMeta("og:description", d, true);
    }
  }, [title, description]);
}
