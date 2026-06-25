import { serverGetSafe } from "./api";

// sitemap 单文件协议上限 50000 条 URL；超过拆成多个 /sitemap/{id}.xml + robots 列全部分片。
export const SITEMAP_CHUNK = 50000;

// 上架影片总数（用于算分片数）。/titles 的 total 即 status=1 可列表数，与 sitemap 口径一致。
async function titleCount(): Promise<number> {
  const d = await serverGetSafe<{ total: number }>("/titles", { size: 1 }, 3600);
  return d?.total ?? 0;
}

// sitemap 分片数（至少 1）。
export async function sitemapChunks(): Promise<number> {
  return Math.max(1, Math.ceil((await titleCount()) / SITEMAP_CHUNK));
}
