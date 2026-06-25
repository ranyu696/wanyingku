// 统一取数层（替代 alova）。
// 服务端（RSC）：serverGet —— 匿名，带 Next 缓存（默认 60s ISR）。
// 客户端：api.get/post/del —— 带 localStorage token，401 清登录态。
// 两者都解 Go 统一响应 {code,message,data}：code!=0 抛错，否则返回 data。
export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8080/api/v1";
export const TOKEN_KEY = "yinshi_token";
export const USER_KEY = "yinshi_user";

type Params = Record<string, unknown> | undefined;

function buildUrl(path: string, params: Params): string {
  const base = path.startsWith("http") ? path : API_BASE + path;
  if (!params) {
    return base;
  }
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") {
      continue;
    }
    qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `${base}?${s}` : base;
}

async function unwrap<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (body && typeof body === "object" && "code" in body) {
    const b = body as { code: number; message?: string; data?: unknown };
    if (b.code !== 0) {
      throw new Error(b.message || "请求失败");
    }
    return b.data as T;
  }
  if (!res.ok) {
    throw new Error("网络错误");
  }
  return body as T;
}

// 服务端取数：匿名 + Next ISR 缓存。revalidate 传 0 表示不缓存。
export async function serverGet<T>(path: string, params?: Params, revalidate = 60): Promise<T> {
  const res = await fetch(buildUrl(path, params), {
    next: revalidate > 0 ? { revalidate } : undefined,
    ...(revalidate > 0 ? {} : { cache: "no-store" }),
  });
  return unwrap<T>(res);
}

// 服务端取数的「软」版本：失败返回 null（用于 generateMetadata / sitemap / 详情页兜底，不抛 500）。
// 失败重试一次：构建期首个/大响应偶发取数失败(冷连接/瞬时)，重试常成功，避免被缓存成空结果。
export async function serverGetSafe<T>(
  path: string,
  params?: Params,
  revalidate = 60,
): Promise<T | null> {
  try {
    return await serverGet<T>(path, params, revalidate);
  } catch {
    try {
      return await serverGet<T>(path, params, revalidate);
    } catch {
      return null;
    }
  }
}

function authHeaders(): Record<string, string> {
  if (typeof localStorage === "undefined") {
    return {};
  }
  const t = localStorage.getItem(TOKEN_KEY);
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function clientRequest<T>(
  method: string,
  path: string,
  params?: Params,
  data?: unknown,
): Promise<T> {
  const headers: Record<string, string> = { ...authHeaders() };
  let body: BodyInit | undefined;
  if (data !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(data);
  }
  const res = await fetch(buildUrl(path, params), { method, headers, body });
  if (res.status === 401 && typeof localStorage !== "undefined") {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  return unwrap<T>(res);
}

export const api = {
  get: <T>(path: string, params?: Params) => clientRequest<T>("GET", path, params),
  post: <T>(path: string, data?: unknown, params?: Params) =>
    clientRequest<T>("POST", path, params, data),
  del: <T>(path: string, params?: Params) => clientRequest<T>("DELETE", path, params),
};
