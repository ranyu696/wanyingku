# 影视聚合（yinshi）

Go 后端的影视采集聚合平台。核心解决一个痛点：**同一部影片在不同苹果CMS采集源里因译名 / 语种 / 写法不同被拆成多条**。本项目用「实体解析（去重归类）」把它们合并成**一条规范作品 + 多条播放源**，给用户清爽统一的观影入口。

## 技术栈

- **后端**：Go + Echo v4 + GORM
- **数据库**：PostgreSQL（`pg_trgm` 模糊匹配 + 可选 `pgvector` 向量召回）
- **缓存**：Redis
- **搜索**：Meilisearch（未启用时自动降级到 DB `pg_trgm`）
- **归类权威源**：TMDB（可选）
- **AI**：OpenAI 兼容的嵌入 / LLM（可选、可插拔，可指向本地 Ollama）

## 去重归类引擎（核心）

四层漏斗，高精度优先、逐层放宽，AI 层未配置时自动跳过：

| 层 | 方法 | 作用 |
|---|---|---|
| 1 | 标题归一化精确命中 | 剥离 `国语/粤语/HD/未删减/年份/季` 后字节相等 → 最便宜的跨源去重 |
| 2 | TMDB 别名匹配 | 用 TMDB id 作聚类主键，不同译名/语种天然合并（权威） |
| 3 | pg_trgm 模糊召回 | 相似度 ≥ 自动合并阈值则合并（如「复仇者联盟4：终局之战」↔「复仇者联盟4」） |
| 4 | 向量召回 + LLM 仲裁 | 灰区交给 embedding 相似度 / 大模型判定（可选） |

兜底：新建规范作品；灰区近邻标记 `needs_review` 待人工，可在管理后台**手动合并**。

数据模型：`titles`(规范作品) ←1:N→ `play_sources`(按 采集源+线路/语种) ←1:N→ `episodes`(剧集)。

## 快速开始

依赖：Go 1.24+、PostgreSQL 16+、Redis。可选：Meilisearch、pgvector。

```bash
# 1. 准备数据库（库名默认 yinshi）
createdb yinshi
make migrate                 # 建表 + pg_trgm
# make migrate-vector        # 可选：启用 pgvector 向量层（需先 brew install pgvector）

# 2. 配置
cp config.yaml.example config.yaml   # 按需改 DSN / TMDB key / AI key

# 3. 初始化管理员
go run ./cmd/seed -admin-user admin -admin-pass admin123

# 4. 启动
make run                     # API 服务（含定时采集）
# 或分开部署：make worker     # 只跑采集调度
```

也可用容器起依赖：`make infra-up`（pgvector + meilisearch + redis）。

## 采集

```bash
# 添加采集源（也可登录管理后台 /admin/sources）
go run ./cmd/seed -source-name 某资源站 -source-url "https://host/api.php/provide/vod/"

# 手动采集一次（增量；-full 全量；-source <id> 指定源）
go run ./cmd/worker -once -full
```

server 内置定时调度（`collect.scheduler_enabled`），按每个源的 `sync_interval_min` 增量采集。

## API 概览（前缀 `/api/v1`）

公开：`POST /auth/register|login`、`GET /home`、`GET /titles`、`GET /titles/:id`、`GET /search`、`GET /genres`、`GET /requests`

需登录：`GET /me`、`/me/favorites`、`/me/history`（保存进度）、`/me/subscriptions`（订阅更新）、`/me/notifications`、`POST /requests`（求片）

管理员：`/admin/sources`（增删改）、`/admin/sources/:id/sync`、`/admin/sync-all`、`/admin/review`（待复核）、`/admin/titles/merge`（人工合并去重）、`/admin/requests`、`/admin/stats`

统一响应：`{ "code": 0, "message": "success", "data": ... }`。

## 开启可选能力

- **TMDB**：`config.yaml` 设 `tmdb.enabled: true` + `api_key`（国内可填 `tmdb.proxy`）。归类准确率大幅提升。
- **Meilisearch**：起服务后设 `meilisearch.enabled: true`，启动时自动建索引并配置可搜索字段。
- **向量层**：`brew install pgvector` → `make migrate-vector` → `ai.vector_enabled: true` + 嵌入提供方（注意维度与 `002_vector.sql` 一致）。
- **LLM 仲裁**：`ai.llm_enabled: true` + `ai.base_url/api_key/chat_model`。

## 测试

```bash
go test ./...                                   # 单元测试（标题归一化等）
go test -tags dbtest ./internal/service/resolve/ -run TestEngineDedup -v   # 去重引擎集成测试（需 DB）
```

## 目录结构

```
cmd/{server,worker,seed}     入口
internal/
  app/            组件装配（server/worker 共用）
  config/ db/ cache/
  model/          GORM 模型（schema 由 migrations 管理）
  repository/     数据访问
  service/
    collect/      苹果CMS 采集 + 解析 + 编排 + 调度
    resolve/      去重归类引擎（四层漏斗）★
    search/       Meilisearch
    title/ userdata/ auth/ request/
  handler/ middleware/ router/
pkg/{tmdb,aiprovider,textutil,jwtutil,response,logger}
migrations/       001 核心表(pg_trgm)，002 可选 pgvector
```

## 路线图

- [x] 后端：采集、去重归类引擎、播放源合并、搜索、求片、订阅更新、收藏/历史、鉴权、管理接口
- [ ] 消费端 PWA（移动优先）：首页/分类/搜索/详情/播放器（hls.js）/我的
- [ ] 管理后台（React + Antd）：采集源、去重复核与合并、求片处理、数据看板
- [ ] 增强：TMDB 富化补全、向量层默认化、douban 评分接入、播放地址有效性探测
