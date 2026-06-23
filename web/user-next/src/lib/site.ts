// 站点常量与对外地址（canonical / og / sitemap / robots 用绝对链接）
export const BRAND = "万影库";
export const DEF_TITLE = `${BRAND} - 海量影视聚合，免费在线观看`;
export const DEF_DESC =
  "万影库聚合全网影视资源，电影、电视剧、动漫、综艺、短剧免费在线观看，多线路高清播放。";

// 生产部署用 SITE_URL；本地回落 5173（与 dev 端口一致）
export const SITE_URL = process.env.SITE_URL || "http://localhost:5173";

export const KIND_LABEL: Record<number, string> = {
  1: "电影",
  2: "电视剧",
  3: "综艺",
  4: "动漫",
  5: "纪录片",
  6: "短剧",
  7: "体育",
};
