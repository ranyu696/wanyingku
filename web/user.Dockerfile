# web/user —— SSR Node 服务。Bun(workspace) 装依赖，Node 运行 server.mjs。
# Railway 构建上下文 = web/（设服务变量 RAILWAY_DOCKERFILE_PATH=user.Dockerfile）。
FROM node:22-slim AS build
RUN npm install -g bun@1.3.14
WORKDIR /app
COPY package.json bun.lock ./
COPY user/package.json ./user/package.json
COPY admin/package.json ./admin/package.json
RUN bun install --frozen-lockfile
COPY . .
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
