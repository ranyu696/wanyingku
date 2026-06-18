# 影视聚合 · 前端（Bun 单体仓库）

Bun workspaces 单体仓库（monorepo），根 `package.json` 的 `workspaces` 含两个应用包；**Bun 装包、[vite-plus](https://viteplus.dev)(`vp`) 负责 dev/build/lint**：

| 目录 | 应用 | 说明 |
|---|---|---|
| `user/` | 用户端 | 移动优先 PWA：首页/分类/搜索/详情+hls播放/我的/登录，BlurHash 占位 |
| `admin/` | 管理后台 | 看板/采集源管理/去重复核与人工合并/求片处理 |

技术栈（两端一致）：**React 19 + MUI 9 + alova（请求）+ TanStack Router + TypeScript**，构建/校验走 `vp`（Oxlint 严格规则）。

## 运行

```bash
cd web && bun install          # 根目录一次性安装整个 workspace

# 方式一：根目录脚本
bun dev:user                   # 启动用户端
bun dev:admin                  # 启动管理后台
bun --filter '*' build         # 构建全部

# 方式二：进入子包（dev/build/lint 仍走 vp）
cd web/user && vp dev          # vp build 构建；vp lint 校验
cd web/admin && vp dev

# 加依赖用 bun：cd web/user && bun add <pkg>
```

后端 API 默认 `http://localhost:8080/api/v1`（后端已开 CORS）。如需改地址，在对应应用根目录建 `.env`：

```
VITE_API_BASE=https://api.yourdomain.com/api/v1
```

## 关键点

- **BlurHash 占位**：`user/src/components/Blurhash.tsx` 解码 `poster_blurhash` 到 canvas，真图加载完淡入。配好后端图床（S3）并跑 `go run ./cmd/rehost` 后，海报会带上 blurhash。
- **图片实时处理**：海报 URL 来自你的图床（CoreIX/S4/OSS 等），前端可在 URL 后拼处理参数（如 `?w=300&fmt=webp&dpr=2`）。建议在 `PosterImage` 里按 `VITE_API_BASE` 同级配置一个图床处理模板统一拼接。
- **播放**：`user/src/components/Player.tsx` 用 hls.js 播 m3u8，每 5s 上报观看进度（登录后）。
- 管理员账号需 `role=1`：`go run ./cmd/seed -admin-user admin -admin-pass admin123`。
