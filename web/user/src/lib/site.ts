// 站点常量与对外地址（canonical / og / sitemap / robots 用绝对链接）
export const BRAND = "万影库";
export const DEF_TITLE = `${BRAND} - 海量影视聚合，免费在线观看`;
// 描述放长到 110-160 字（含义不变，补足分类/卖点）：搜索结果/OG 卡片展示更完整
export const DEF_DESC =
  "万影库是专业的影视聚合平台，汇聚全网优质资源每日更新，涵盖热门电影、电视剧、动漫、综艺、纪录片、短剧与体育赛事，支持多线路高清免费在线观看，无需下载、无广告打扰，手机、平板、电脑随时随地畅享流畅稳定的观影体验。";

// X/Twitter 归属账号。ponytail: 占位为品牌名，没有官方号就改成真实 @handle 或删掉
export const TWITTER_SITE = "@wanyingku";

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
