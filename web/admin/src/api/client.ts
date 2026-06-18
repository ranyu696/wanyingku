import { createAlova } from "alova";
import adapterFetch from "alova/fetch";
import ReactHook from "alova/react";

export const API_BASE =
  (import.meta.env.VITE_API_BASE as string | undefined) ||
  "http://localhost:8080/api/v1";
export const TOKEN_KEY = "yinshi_admin_token";

export const alova = createAlova({
  baseURL: API_BASE,
  statesHook: ReactHook,
  requestAdapter: adapterFetch(),
  beforeRequest(method) {
    const t = localStorage.getItem(TOKEN_KEY);
    if (t) {
      method.config.headers = { ...method.config.headers, Authorization: `Bearer ${t}` };
    }
  },
  responded: {
    onSuccess: async (response) => {
      if (response.status === 401) {
        localStorage.removeItem(TOKEN_KEY);
      }
      let body: unknown;
      try {
        body = await response.json();
      } catch {
        body = null;
      }
      if (body && typeof body === "object" && "code" in body) {
        const b = body as { code: number; message?: string; data?: unknown };
        if (b.code !== 0) {
          throw new Error(b.message || "请求失败");
        }
        return b.data;
      }
      if (!response.ok) {
        throw new Error("网络错误");
      }
      return body;
    },
  },
});
