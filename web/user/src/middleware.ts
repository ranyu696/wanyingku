import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// 按 User-Agent 硬挡爬虫：robots.txt 之外的兜底，挡掉伪造 UA / 不遵守 robots 的。
const BLOCKED_UA = [
  /AhrefsBot/i,
  /SemrushBot/i,
  /MJ12bot/i,
  /DotBot/i,
  /BLEXBot/i,
  /DataForSeoBot/i,
  /PetalBot/i,
];

export function middleware(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (BLOCKED_UA.some((re) => re.test(ua))) {
    return new NextResponse("Forbidden", { status: 403 });
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
