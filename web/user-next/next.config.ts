import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 海报来自任意外部 CDN，不走 next/image 优化（仍用普通 <img>），免去 remotePatterns 配置
  images: { unoptimized: true },
};

export default nextConfig;
