import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { API_BASE } from "@/lib/api";
import { DEF_DESC, DEF_TITLE, ogBase, SITE_URL, TWITTER_SITE } from "@/lib/site";

// 海报/图片都来自 API_BASE 的主机（api.wanyingku.com）→ 预连接省一次 TLS 握手，加速 LCP 大图
const IMG_ORIGIN = new URL(API_BASE).origin;
import Providers from "@/components/Providers";
import Shell from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: DEF_TITLE,
  description: DEF_DESC,
  manifest: "/manifest.webmanifest",
  // icon 走文件约定：app/favicon.ico + app/apple-icon.png（Next 自动注入 link）
  verification: { yandex: "9953cfca35e0410f" },
  // og:image 走 app/opengraph-image.png 文件约定；alt 走同目录 opengraph-image.alt.txt
  openGraph: ogBase,
  twitter: {
    card: "summary_large_image",
    site: TWITTER_SITE,
    creator: TWITTER_SITE,
    title: DEF_TITLE,
    description: DEF_DESC,
  },
};

export const viewport: Viewport = {
  themeColor: "#08080c",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href={IMG_ORIGIN} />
        <link rel="dns-prefetch" href={IMG_ORIGIN} />
      </head>
      <body>
        <Providers>
          {/* Shell 读 usePathname(请求期数据)，PPR 下用 Suspense 包住：html/body 作静态壳秒发，导航+页面流式补入 */}
          <Suspense fallback={null}>
            <Shell>{children}</Shell>
          </Suspense>
        </Providers>
      </body>
    </html>
  );
}
