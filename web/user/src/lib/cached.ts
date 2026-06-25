import { cacheLife } from "next/cache";
import { serverGetSafe } from "./api";
import type { DetailResp, Genre, HomeData, Paged, Title } from "./types";

// 缓存的服务端取数（PPR：进静态壳 / 快命中，降 Go API 负载、TTFB）。按参数做缓存键，cacheLife 时间失效保新鲜。
// ponytail: 只用 cacheLife 时间失效——采集是 9 万片高频 churn，逐片 cacheTag + webhook 失效不划算；
//   几分钟内自然新鲜更适合本站。要「片更新即时失效」再加 revalidateTag 路由 + Go 回调。

export async function getHome() {
  "use cache";
  cacheLife("minutes");
  return serverGetSafe<HomeData>("/home");
}

export async function getDetail(id: string) {
  "use cache";
  cacheLife("minutes");
  return serverGetSafe<DetailResp>(`/titles/${id}`);
}

export async function getTitles(params: Record<string, unknown>) {
  "use cache";
  cacheLife("minutes");
  return serverGetSafe<Paged<Title>>("/titles", params);
}

export async function getGenres(kind: number) {
  "use cache";
  cacheLife("hours");
  return serverGetSafe<Genre[]>("/genres", { kind });
}

export async function getTags(kind: number) {
  "use cache";
  cacheLife("hours");
  return serverGetSafe<string[]>("/tags", { kind });
}

export async function getPeople(name: string) {
  "use cache";
  cacheLife("minutes");
  return serverGetSafe<Paged<Title>>("/people", { name, size: 60 });
}

export interface CollectionData {
  title: string;
  desc: string;
  list: Title[];
  total: number;
}

export async function getCollection(key: string) {
  "use cache";
  cacheLife("minutes");
  return serverGetSafe<CollectionData>(`/collections/${key}`, { size: 60 });
}
