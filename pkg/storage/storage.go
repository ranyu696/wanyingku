// Package storage 抽象图床/对象存储：把 TMDB / 采集源的图片转存到自己的 S3 桶，
// 并计算 BlurHash 哈希占位（前端先显模糊占位再加载真图）。未配置时 Noop 原样返回外链。
package storage

import "context"

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
}

// Noop 未配置时的实现：原样返回外链，无占位。
type Noop struct{}

func (Noop) Enabled() bool                            { return false }
func (Noop) Rehost(_ context.Context, src string) Image { return Image{URL: src} }
