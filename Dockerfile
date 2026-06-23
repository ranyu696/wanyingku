# 后端 API（cmd/server）多阶段镜像。需 cgo 编译 WebP 编码器(chai2010/webp 内置 libwebp)，
# 故用 Debian 基底(glibc, 自带 gcc)，CGO_ENABLED=1。Railway 自动识别本 Dockerfile。
FROM golang:1.26-bookworm AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=1 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM debian:bookworm-slim
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates tzdata && rm -rf /var/lib/apt/lists/*
COPY --from=build /out/server /app/server
COPY config.railway.yaml /app/config.yaml
COPY migrations /app/migrations
ENV TZ=Asia/Shanghai
EXPOSE 8080
ENTRYPOINT ["/app/server", "-config", "/app/config.yaml"]
