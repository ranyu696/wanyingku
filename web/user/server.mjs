// SSR 开发/生产服务器：用 Vite+ 内核(@voidzero-dev/vite-plus-core)的编程式 API。
//   dev:  node server.mjs            （Vite 中间件 + ssrLoadModule）
//   prod: NODE_ENV=production node server.mjs（读 dist/client + dist/server 构建产物）
// SEO 关键的 <title>/<meta description>/og 由 resolveHead 按路由注入（详情页从 Go API 取真实数据）。
import fs from "node:fs";
import path from "node:path";
import http from "node:http";

const isProd = process.env.NODE_ENV === "production";
const API = process.env.API_BASE || "http://localhost:8080";
const PORT = Number(process.env.PORT || 5173);
const root = import.meta.dirname;

const BRAND = "万影库";
const DEF_TITLE = `${BRAND} - 海量影视聚合，免费在线观看`;
const DEF_DESC =
  "万影库聚合全网影视资源，电影、电视剧、动漫、综艺、短剧免费在线观看，多线路高清播放。";

function esc(s) {
  return String(s ?? "").replace(
    /[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c],
  );
}

const KIND_LABEL = { 1: "电影", 2: "电视剧", 3: "综艺", 4: "动漫", 5: "纪录片", 6: "短剧" };

function splitNames(s) {
  return String(s || "")
    .split(/[,，、/]/)
    .map((x) => x.trim())
    .filter(Boolean);
}

// JSON-LD <script>（转义 < 防止 </script> 截断）
function ldScript(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, "\\u003c")}</script>`;
}

function detailLd(d, origin) {
  const isSeries = d.kind !== 1;
  const obj = {
    "@context": "https://schema.org",
    "@type": isSeries ? "TVSeries" : "Movie",
    name: d.name,
    url: `${origin}/title/${d.slug || d.id}`,
  };
  if (d.poster) obj.image = d.poster;
  if (d.overview) obj.description = String(d.overview).replace(/\s+/g, " ").trim();
  if (d.year) obj.datePublished = String(d.year);
  const genres = (d.genres || []).map((g) => g.name).filter(Boolean);
  if (genres.length) obj.genre = genres;
  const dirs = splitNames(d.director);
  if (dirs.length) obj.director = dirs.map((n) => ({ "@type": "Person", name: n }));
  const actors = splitNames(d.actors).slice(0, 10);
  if (actors.length) obj.actor = actors.map((n) => ({ "@type": "Person", name: n }));
  const rating = d.vote_average || d.douban_rating;
  const count = d.vote_count || d.douban_votes;
  if (rating > 0) {
    obj.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(rating).toFixed(1),
      bestRating: 10,
      ratingCount: count > 0 ? count : 1,
    };
  }
  if (isSeries && d.total_episodes > 0) obj.numberOfEpisodes = d.total_episodes;
  return obj;
}

function breadcrumbLd(d, origin) {
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

function websiteLd(origin) {
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

// 按路由解析 标题/描述/og + JSON-LD 结构化数据（详情页查 Go API 拿真实数据）
async function resolveHead(url, origin) {
  let title = DEF_TITLE;
  let desc = DEF_DESC;
  let image = "";
  let canonical = origin + url.split("?")[0];
  const ld = [];
  const m = url.match(/^\/title\/([^/?#]+)/);
  if (m) {
    try {
      const r = await fetch(`${API}/api/v1/titles/${encodeURIComponent(m[1])}`);
      const d = (await r.json())?.data?.detail;
      if (d?.name) {
        title = `${d.name}${d.year ? ` (${d.year})` : ""} 在线观看 - ${BRAND}`;
        if (d.overview) desc = String(d.overview).replace(/\s+/g, " ").trim().slice(0, 150);
        if (d.poster) image = d.poster;
        canonical = `${origin}/title/${d.slug || d.id}`; // 规范地址用 slug，和 sitemap 一致
        ld.push(detailLd(d, origin), breadcrumbLd(d, origin));
      }
    } catch {
      /* 取数失败用默认 */
    }
  } else if (url === "/" || url.startsWith("/?")) {
    title = DEF_TITLE;
    ld.push(websiteLd(origin));
  } else if (url.startsWith("/category")) {
    title = `影视分类大全 - ${BRAND}`;
  } else if (url.startsWith("/rank")) {
    title = `影视排行榜 - ${BRAND}`;
  } else if (url.startsWith("/search")) {
    title = `影视搜索 - ${BRAND}`;
  } else if (url.startsWith("/requests")) {
    title = `求片中心 - ${BRAND}`;
  }
  const tags = [
    `<title>${esc(title)}</title>`,
    `<link rel="canonical" href="${esc(canonical)}">`,
    `<meta name="description" content="${esc(desc)}">`,
    `<meta property="og:site_name" content="${BRAND}">`,
    `<meta property="og:type" content="${m ? "video.other" : "website"}">`,
    `<meta property="og:title" content="${esc(title)}">`,
    `<meta property="og:description" content="${esc(desc)}">`,
  ];
  if (image) tags.push(`<meta property="og:image" content="${esc(image)}">`);
  return tags.concat(ld.map(ldScript)).join("\n    ");
}

let vite;
let prodTemplate = "";
let prodRender;
if (!isProd) {
  const { createServer } = await import("vite");
  vite = await createServer({ root, server: { middlewareMode: true }, appType: "custom" });
} else {
  prodTemplate = fs.readFileSync(path.join(root, "dist/client/index.html"), "utf-8");
  prodRender = (await import("./dist/server/entry-server.js")).render;
}

async function handle(req, res) {
  try {
    const url = req.url || "/";
    let template;
    let render;
    if (!isProd) {
      template = fs.readFileSync(path.join(root, "index.html"), "utf-8");
      template = await vite.transformIndexHtml(url, template);
      render = (await vite.ssrLoadModule("/src/entry-server.tsx")).render;
    } else {
      template = prodTemplate;
      render = prodRender;
    }
    const origin = process.env.SITE_URL || `http://${req.headers.host || "localhost"}`;
    const [{ html, ssr }, head] = await Promise.all([render(url), resolveHead(url, origin)]);
    // emotion(MUI)的 SSR build 把 <style data-emotion> 内联进 #root 组件树，而客户端 build 改用
    // insertion effect 注入 <head>、首帧不渲染这些 style 元素；React 19 又不 hoist 无 precedence 的
    // <style> → 水合时 #root 首个子节点(style vs div)结构不一致，报 React #418。
    // 把内联 style 抽进 <head>：body 即与客户端首帧一致，水合通过；client 的 emotion cache 会认领同名标签。
    const styles = [];
    const bodyHtml = html.replace(
      /<style[^>]*\bdata-emotion=[^>]*>[\s\S]*?<\/style>/g,
      (m) => (styles.push(m), ""),
    );
    const dehydrate =
      ssr && Object.keys(ssr).length
        ? `\n    <script>window.__SSR__=${JSON.stringify(ssr).replace(/</g, "\\u003c")}</script>`
        : "";
    const out = template
      .replace("<!--app-head-->", head + styles.join("") + dehydrate)
      .replace("<!--app-html-->", bodyHtml);
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(out);
  } catch (e) {
    vite?.ssrFixStacktrace?.(e);
    console.error(e);
    res.statusCode = 500;
    res.end(String(e?.stack || e));
  }
}

// 资源/模块请求（/@vite、/src、node_modules、带扩展名的文件）交给 Vite/静态；
// 其余（导航 HTML，如 /、/title/123）走我们的 SSR handle —— Vite+ 自带的 HTML 服务会抢，故手动分流。
function isAssetReq(url) {
  return (
    url.startsWith("/@") ||
    url.startsWith("/src/") ||
    url.startsWith("/node_modules") ||
    /\.[\w]+(\?|$)/.test(url)
  );
}

const MIME = {
  ".js": "text/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".json": "application/json",
  ".woff2": "font/woff2",
};

function serveStatic(req, res) {
  const file = path.join(root, "dist/client", (req.url || "/").split("?")[0]);
  fs.readFile(file, (err, buf) => {
    if (err) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }
    res.setHeader("Content-Type", MIME[path.extname(file)] || "application/octet-stream");
    res.end(buf);
  });
}

// robots.txt / sitemap.xml 动态生成（用请求 origin 拼绝对地址）
function siteOrigin(req) {
  return process.env.SITE_URL || `http://${req.headers.host || "localhost"}`;
}

function serveRobots(req, res) {
  const origin = siteOrigin(req);
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(
    `User-agent: *\nAllow: /\nDisallow: /mine\nDisallow: /login\nDisallow: /watch/\n\nSitemap: ${origin}/sitemap.xml\n`,
  );
}

async function serveSitemap(req, res) {
  const origin = siteOrigin(req);
  const entries = ["/", "/category", "/rank", "/requests"].map(
    (p) => `<url><loc>${origin}${p}</loc></url>`,
  );
  try {
    const r = await fetch(`${API}/api/v1/sitemap`);
    for (const t of (await r.json())?.data || []) {
      const slug = esc(String(t.slug || t.id));
      const lm = t.updated_at ? `<lastmod>${t.updated_at}</lastmod>` : "";
      entries.push(`<url><loc>${origin}/title/${slug}</loc>${lm}</url>`);
    }
  } catch {
    /* API 不可用则只给静态路由 */
  }
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.end(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries.join("\n")}\n</urlset>`,
  );
}

const server = http.createServer((req, res) => {
  const url = req.url || "/";
  if (url === "/robots.txt") {
    serveRobots(req, res);
    return;
  }
  if (url.split("?")[0] === "/sitemap.xml") {
    serveSitemap(req, res);
    return;
  }
  if (isAssetReq(url)) {
    if (isProd) {
      serveStatic(req, res);
    } else {
      vite.middlewares(req, res, () => {
        res.statusCode = 404;
        res.end("Not found");
      });
    }
    return;
  }
  handle(req, res);
});
server.listen(PORT, () => console.log(`SSR ${isProd ? "prod" : "dev"}: http://localhost:${PORT}`));
