// Package storage 抽象图床/对象存储：把 TMDB / 采集源的图片转存到自己的 S3 桶，
// 并计算 BlurHash 哈希占位（前端先显模糊占位再加载真图）。未配置时 Noop 原样返回外链。
package storage

import (
	"context"
	"errors"
	"io"
)

// Image 转存结果：自有公开 URL + BlurHash 占位串。
type Image struct {
	URL      string `json:"url"`
	BlurHash string `json:"blurhash,omitempty"`
}

type Storage interface {
	Enabled() bool
	// Rehost 下载 srcURL，存入对象存储并计算 BlurHash，返回结果；
	// 失败或未启用时 URL 原样返回 srcURL、BlurHash 为空。
	Rehost(ctx context.Context, srcURL string) Image
	// PresignGet 为对象 key 生成临时预签名 GET URL（私有桶 + 后端重定向分发用）。
	PresignGet(ctx context.Context, key string) (string, error)
	// Get 读取对象内容用于后端代理分发（返回流 + content-type）。
	Get(ctx context.Context, key string) (io.ReadCloser, string, error)
	// GC 删除桶里 keep 集合之外的对象（无人引用的孤儿图）。dry=true 只统计不删。返回 删/计数, 扫描数。
	GC(ctx context.Context, keep map[string]bool, dry bool) (deleted, scanned int, err error)
}

// Noop 未配置时的实现：原样返回外链，无占位。
type Noop struct{}

func (Noop) Enabled() bool                              { return false }
func (Noop) Rehost(_ context.Context, src string) Image { return Image{URL: src} }
func (Noop) PresignGet(context.Context, string) (string, error) {
	return "", errors.New("storage disabled")
}
func (Noop) Get(context.Context, string) (io.ReadCloser, string, error) {
	return nil, "", errors.New("storage disabled")
}
func (Noop) GC(context.Context, map[string]bool, bool) (int, int, error) { return 0, 0, nil }
