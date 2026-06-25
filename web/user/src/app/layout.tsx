import type { Metadata, Viewport } from "next";
import { Suspense } from "react";
import { BRAND, DEF_DESC, DEF_TITLE, SITE_URL } from "@/lib/site";
import Providers from "@/components/Providers";
import Shell from "@/components/Shell";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: DEF_TITLE,
  description: DEF_DESC,
  manifest: "/manifest.webmanifest",
  icons: { icon: "/favicon.svg" },
  verification: { yandex: "9953cfca35e0410f" },
  openGraph: {
    siteName: BRAND,
    type: "website",
    title: DEF_TITLE,
    description: DEF_DESC,
  },
  twitter: {
    card: "summary_large_image",
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
