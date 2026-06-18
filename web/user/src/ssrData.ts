// 路由 loader 取数 + SSR 脱水/注水。
// 服务端：loader 直接请求拿到数据 → renderToString 出带正文的 HTML；
//   entry-server 再把各路由 loader 数据按 pathname 序列化进 window.__SSR__。
// 客户端：loader 首次命中注入数据就同步复用（用完即删），避免二次请求 + 水合不一致；
//   之后的导航/失效再走真实请求。
export async function loadWithSSR<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const w = globalThis as unknown as { __SSR__?: Record<string, unknown> };
  if (w.__SSR__ && key in w.__SSR__) {
    const cached = w.__SSR__[key] as T;
    delete w.__SSR__[key];
    return cached;
  }
  return fetcher();
}
