DB ?= yinshi

.PHONY: help run worker build tidy migrate migrate-vector seed-sources fmt vet test infra-up infra-down

help:
	@echo "make run            # 启动 API 服务 (cmd/server)"
	@echo "make worker         # 单独启动采集 worker (cmd/worker)"
	@echo "make build          # 编译到 bin/"
	@echo "make migrate        # 应用核心表结构到库 $(DB)"
	@echo "make migrate-vector # 应用可选 pgvector 迁移 (需先 brew install pgvector)"
	@echo "make infra-up       # 用 docker 起 pg+meili+redis (可选, 本机已装则不需要)"

run:
	go run ./cmd/server

worker:
	go run ./cmd/worker

build:
	go build -o bin/server ./cmd/server
	go build -o bin/worker ./cmd/worker

tidy:
	go mod tidy

fmt:
	gofmt -w .

vet:
	go vet ./...

test:
	go test ./...

migrate:
	psql -d $(DB) -f migrations/001_init.sql

migrate-vector:
	psql -d $(DB) -f migrations/002_vector.sql

infra-up:
	docker compose up -d

infra-down:
	docker compose down
