import { StrictMode } from "react";
import { renderToString } from "react-dom/server";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { RouterProvider, createMemoryHistory } from "@tanstack/react-router";
import { createAppRouter } from "./router";
import { theme } from "./theme";

// SSR：按请求 URL 建一个内存 history 的 router，加载匹配后渲染成 HTML 字符串。
// 数据仍由各页客户端拉取（首屏渲染骨架/Loading，水合后填充）；SEO 关键的标题/描述由 server.mjs 注入 head。
export async function render(url: string): Promise<{ html: string; ssr: Record<string, unknown> }> {
  const router = createAppRouter(createMemoryHistory({ initialEntries: [url] }));
  await router.load();
  const html = renderToString(
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </StrictMode>,
  );
  // 脱水：把各匹配路由的 loader 数据按 pathname 收集，注入到客户端 window.__SSR__
  const ssr: Record<string, unknown> = {};
  for (const m of router.state.matches) {
    if (m.loaderData !== undefined) {
      ssr[m.pathname] = m.loaderData;
    }
  }
  return { html, ssr };
}
