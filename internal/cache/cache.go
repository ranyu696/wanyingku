package cache

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/redis/go-redis/v9"
	"github.com/xiaoxin/cms/internal/config"
)

// Cache 是对 Redis 的薄封装，提供 JSON 读写与失效辅助。
type Cache struct {
	rdb *redis.Client
	ttl time.Duration
}

func New(cfg *config.Config) (*Cache, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()
	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, err
	}
	return &Cache{rdb: rdb, ttl: time.Duration(cfg.Redis.CacheTTLSec) * time.Second}, nil
}

func (c *Cache) Client() *redis.Client     { return c.rdb }
func (c *Cache) DefaultTTL() time.Duration { return c.ttl }

func (c *Cache) GetJSON(ctx context.Context, key string, dst any) (bool, error) {
	b, err := c.rdb.Get(ctx, key).Bytes()
	if errors.Is(err, redis.Nil) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	if err := json.Unmarshal(b, dst); err != nil {
		return false, err
	}
	return true, nil
}

func (c *Cache) SetJSON(ctx context.Context, key string, v any, ttl time.Duration) error {
	b, err := json.Marshal(v)
	if err != nil {
		return err
	}
	if ttl <= 0 {
		ttl = c.ttl
	}
	return c.rdb.Set(ctx, key, b, ttl).Err()
}

func (c *Cache) Del(ctx context.Context, keys ...string) {
	if len(keys) > 0 {
		_ = c.rdb.Del(ctx, keys...).Err()
	}
}

// DelByPrefix 删除前缀匹配的键（量大时慎用）。
func (c *Cache) DelByPrefix(ctx context.Context, prefix string) {
	iter := c.rdb.Scan(ctx, 0, prefix+"*", 200).Iterator()
	for iter.Next(ctx) {
		_ = c.rdb.Del(ctx, iter.Val()).Err()
	}
}
