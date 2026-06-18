import { StrictMode } from "react";
import { hydrateRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { theme } from "./theme";
import "./index.css";

// 水合 SSR 输出（客户端用浏览器 history 的单例 router）。
// 必须先 router.load() 把初始匹配解析完再 hydrate：服务端是 await load() 后渲染出的「已解析内容」，
// 若客户端直接 hydrate，首帧会渲染 router 的 pending <Suspense fallback={null}>，与服务端 <div> 不一致 → 水合报错。
// （详情 loader 通过 loadWithSSR 同步复用 window.__SSR__，load 很快，不会拖慢可交互。）
router.load().then(() => {
  hydrateRoot(
    document.getElementById("root")!,
    <StrictMode>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <RouterProvider router={router} />
      </ThemeProvider>
    </StrictMode>,
  );
});
