# web/admin —— 静态 SPA。Bun(workspace) 装依赖+构建，serve 提供（含 SPA 回退）。
# Railway 构建上下文 = web/（设服务变量 RAILWAY_DOCKERFILE_PATH=admin.Dockerfile）。
FROM node:22-slim AS build
# vite-plus 的 Rust 构建器(vp)需要系统 CA 证书，slim 镜像默认不带。
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
RUN npm install -g bun@1.3.14
WORKDIR /app
COPY package.json bun.lock ./
COPY user/package.json ./user/package.json
COPY admin/package.json ./admin/package.json
RUN bun install --frozen-lockfile
COPY . .
ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE
RUN cd admin && bun run build

FROM node:22-slim
WORKDIR /app
RUN npm install -g serve@14
COPY --from=build /app/admin/dist /app/dist
EXPOSE 8080
CMD ["sh", "-c", "serve -s dist -l ${PORT:-8080}"]
