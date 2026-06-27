import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 海报来自任意外部 CDN，不走 next/image 优化（仍用普通 <img>），免去 remotePatterns 配置
  images: { unoptimized: true },
  // PPR：预渲染静态壳秒发、动态数据流式补入；数据默认动态，用 "use cache" 显式缓存。
  cacheComponents: true,
  // 即时导航：每条路由只预取一个可复用 shell（而非每个 link 一个请求），客户端缓存复用
  partialPrefetching: true,
};

export default nextConfig;
