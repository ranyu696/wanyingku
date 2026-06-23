# web/user —— SSR Node 服务。构建上下文 = 仓库根（Railway/GitHub 从根部署），故 COPY 用 web/ 前缀。
# 设服务变量 RAILWAY_DOCKERFILE_PATH=web/user.Dockerfile。
FROM node:22-slim AS build
RUN npm install -g bun@1.3.14
WORKDIR /app
COPY web/package.json web/bun.lock ./
COPY web/user/package.json ./user/package.json
COPY web/admin/package.json ./admin/package.json
RUN bun install --frozen-lockfile
COPY web/ ./
ARG VITE_API_BASE
ENV VITE_API_BASE=$VITE_API_BASE
RUN cd user && bun run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
WORKDIR /app/user
EXPOSE 8080
CMD ["node", "server.mjs"]
