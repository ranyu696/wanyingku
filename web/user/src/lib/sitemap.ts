import { serverGetSafe } from "./api";

// 每片 15000 条（远小于 50000 协议上限）：响应 <2MB、构建期取数快且稳，避免大响应偶发失败缓存成空片。
// 必须与后端 /sitemap 的 page size 一致。
export const SITEMAP_CHUNK = 15000;

// 上架影片总数（用于算分片数）。/titles 的 total 即 status=1 可列表数，与 sitemap 口径一致。
async function titleCount(): Promise<number> {
  const d = await serverGetSafe<{ total: number }>("/titles", { size: 1 });
  return d?.total ?? 0;
}

// sitemap 分片数（至少 1）。
export async function sitemapChunks(): Promise<number> {
  return Math.max(1, Math.ceil((await titleCount()) / SITEMAP_CHUNK));
}
