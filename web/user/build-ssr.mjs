// 生产构建：客户端包 → dist/client，SSR 包 → dist/server（Vite+ 内核编程式 API）。
// 之后用 `NODE_ENV=production node server.mjs` 起服务。
import { build } from "vite";

console.log("[1/2] building client → dist/client");
await build({ build: { outDir: "dist/client", emptyOutDir: true } });

console.log("[2/2] building server → dist/server");
await build({
  build: { ssr: "src/entry-server.tsx", outDir: "dist/server", emptyOutDir: true },
});

console.log("SSR build done.");
