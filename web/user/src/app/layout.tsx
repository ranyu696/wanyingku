import type { Metadata, Viewport } from "next";
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
          <Shell>{children}</Shell>
        </Providers>
      </body>
    </html>
  );
}
