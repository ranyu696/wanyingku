import { defineConfig, devices } from "@playwright/test";

// instant() 即时导航防回归。prefetch / 即时导航只在 production 生效，故 webServer 跑 build + start。
// 本地无 .env，注入线上 API 让首页/详情有真实数据。
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: { baseURL: "http://localhost:8080", trace: "on-first-retry" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "bun run build && bun run start",
    url: "http://localhost:8080",
    timeout: 300_000,
    reuseExistingServer: true,
    env: {
      NEXT_PUBLIC_API_BASE: "https://api.wanyingku.com/api/v1",
      SITE_URL: "http://localhost:8080",
    },
  },
});
