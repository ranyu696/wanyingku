# web/user-next —— Next.js 16 SSR 服务。构建上下文 = 仓库根（Railway/GitHub 从根部署），故 COPY 用 web/ 前缀。
# 设服务变量 RAILWAY_DOCKERFILE_PATH=web/user-next.Dockerfile。
# 客户端取数基址用 NEXT_PUBLIC_API_BASE（构建期注入，需含 /api/v1）。
FROM node:22-slim AS build
RUN npm install -g bun@1.3.14
WORKDIR /app
COPY web/package.json web/bun.lock ./
COPY web/user/package.json ./user/package.json
COPY web/user-next/package.json ./user-next/package.json
COPY web/admin/package.json ./admin/package.json
RUN bun install --frozen-lockfile
COPY web/ ./
ARG NEXT_PUBLIC_API_BASE
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN cd user-next && bun run build

FROM node:22-slim
RUN npm install -g bun@1.3.14
WORKDIR /app/user-next
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 8080
CMD ["bun", "run", "start"]
