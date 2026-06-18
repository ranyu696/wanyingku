// Package aiprovider 抽象嵌入(embedding)与对话(chat)能力，统一走 OpenAI 兼容协议，
// 可指向 OpenAI / 本地 Ollama / 任意兼容端点。未配置时 Enabled()=false，引擎自动降级。
package aiprovider

import (
	"context"
	"errors"
)

var ErrDisabled = errors.New("aiprovider: not configured")

// Provider 统一接口。
type Provider interface {
	Enabled() bool
	Embed(ctx context.Context, inputs []string) ([][]float32, error)
	Chat(ctx context.Context, system, user string) (string, error)
	EmbeddingDim() int
}

// Noop 是禁用态实现。
type Noop struct{}

func (Noop) Enabled() bool                                        { return false }
func (Noop) Embed(context.Context, []string) ([][]float32, error) { return nil, ErrDisabled }
func (Noop) Chat(context.Context, string, string) (string, error) { return "", ErrDisabled }
func (Noop) EmbeddingDim() int                                    { return 0 }
