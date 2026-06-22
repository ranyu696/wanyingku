# 后端 API（cmd/server）多阶段镜像。Railway 自动识别本 Dockerfile 构建 rare-alignment 服务。
FROM golang:1.26-alpine AS build
WORKDIR /src
RUN apk add --no-cache ca-certificates tzdata git
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/server ./cmd/server

FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache ca-certificates tzdata
COPY --from=build /out/server /app/server
COPY config.railway.yaml /app/config.yaml
COPY migrations /app/migrations
ENV TZ=Asia/Shanghai
EXPOSE 8080
ENTRYPOINT ["/app/server", "-config", "/app/config.yaml"]
