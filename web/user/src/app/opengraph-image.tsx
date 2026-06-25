import { ImageResponse } from "next/og";
import { cacheLife } from "next/cache";
import { BRAND } from "@/lib/site";

// 站点默认 OG 社交分享图（1200×630）。覆盖所有未设专属图的路由；
// 详情页 generateMetadata 里设了真实海报 og:image，会优先于本默认图。
export const alt = `${BRAND} - 海量影视聚合`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const TAGLINE = "海量影视聚合 · 免费在线观看";
const KINDS = "电影 · 电视剧 · 动漫 · 综艺 · 短剧 · 纪录片";

// Satori 默认字体不含中文 → 按用到的字形从 Google Fonts 取子集 TTF（next/og 不支持 woff2，用旧 UA 拿 ttf）。
// "use cache"：PPR 下 OG 图静态预渲染，未缓存的 fetch 在预渲染期会挂；缓存字体(base64 可序列化)后可静态生成。
async function loadCjkFontB64(text: string): Promise<string | null> {
  "use cache";
  cacheLife("max");
  try {
    const url = `https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@700&text=${encodeURIComponent(text)}`;
    const css = await fetch(url, {
      headers: {
        // 旧 UA → Google 返回 ttf（truetype）而非现代 woff2
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; rv:10.0) Gecko/20100101 Firefox/10.0",
      },
    }).then((r) => r.text());
    const m = css.match(/src:\s*url\(([^)]+)\)\s*format\('(?:opentype|truetype)'\)/);
    if (!m) {
      return null;
    }
    const buf = await fetch(m[1]).then((r) => r.arrayBuffer());
    return Buffer.from(buf).toString("base64"); // base64：use cache 可序列化
  } catch {
    return null; // 取字失败：兜底用默认字体（中文可能缺字，但不让构建/请求挂）
  }
}

export default async function OgImage() {
  const b64 = await loadCjkFontB64(BRAND + TAGLINE + KINDS);
  const font = b64 ? Buffer.from(b64, "base64") : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0a12 0%, #14141d 100%)",
          color: "#f6f6fb",
        }}
      >
        <div style={{ display: "flex", fontSize: 132, fontWeight: 700, letterSpacing: 4 }}>
          <span style={{ color: "#ff3d5a" }}>万</span>
          <span>影库</span>
        </div>
        <div
          style={{
            display: "flex",
            width: 160,
            height: 8,
            marginTop: 28,
            borderRadius: 4,
            background: "linear-gradient(90deg, #ff3d5a, #8b5cf6)",
          }}
        />
        <div style={{ display: "flex", fontSize: 40, marginTop: 36, color: "#cfcfe0" }}>
          {TAGLINE}
        </div>
        <div style={{ display: "flex", fontSize: 28, marginTop: 18, color: "#8b8ba0" }}>
          {KINDS}
        </div>
      </div>
    ),
    {
      ...size,
      fonts: font
        ? [{ name: "Noto Sans SC", data: font, weight: 700, style: "normal" }]
        : undefined,
    },
  );
}
