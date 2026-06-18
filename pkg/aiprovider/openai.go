package aiprovider

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
)

// OpenAICompatible 走 OpenAI 兼容的 /embeddings 与 /chat/completions。
type OpenAICompatible struct {
	http           *resty.Client
	embeddingModel string
	embeddingDim   int
	chatModel      string
	vectorOn       bool
	llmOn          bool
}

type Options struct {
	BaseURL        string
	APIKey         string
	EmbeddingModel string
	EmbeddingDim   int
	ChatModel      string
	VectorEnabled  bool
	LLMEnabled     bool
	Timeout        time.Duration
}

func NewOpenAICompatible(o Options) *OpenAICompatible {
	h := resty.New().
		SetBaseURL(strings.TrimRight(o.BaseURL, "/")).
		SetTimeout(o.Timeout).
		SetHeader("Content-Type", "application/json")
	if o.APIKey != "" {
		h.SetAuthToken(o.APIKey)
	}
	return &OpenAICompatible{
		http:           h,
		embeddingModel: o.EmbeddingModel,
		embeddingDim:   o.EmbeddingDim,
		chatModel:      o.ChatModel,
		vectorOn:       o.VectorEnabled,
		llmOn:          o.LLMEnabled,
	}
}

func (p *OpenAICompatible) Enabled() bool     { return p.vectorOn || p.llmOn }
func (p *OpenAICompatible) EmbeddingDim() int { return p.embeddingDim }

type embReq struct {
	Model string   `json:"model"`
	Input []string `json:"input"`
}
type embResp struct {
	Data []struct {
		Embedding []float32 `json:"embedding"`
	} `json:"data"`
	Error *apiErr `json:"error,omitempty"`
}
type apiErr struct {
	Message string `json:"message"`
}

func (p *OpenAICompatible) Embed(ctx context.Context, inputs []string) ([][]float32, error) {
	if !p.vectorOn {
		return nil, ErrDisabled
	}
	var out embResp
	resp, err := p.http.R().
		SetContext(ctx).
		SetBody(embReq{Model: p.embeddingModel, Input: inputs}).
		SetResult(&out).
		Post("/embeddings")
	if err != nil {
		return nil, err
	}
	if resp.IsError() || out.Error != nil {
		msg := resp.Status()
		if out.Error != nil {
			msg = out.Error.Message
		}
		return nil, fmt.Errorf("embeddings: %s", msg)
	}
	vecs := make([][]float32, len(out.Data))
	for i, d := range out.Data {
		vecs[i] = d.Embedding
	}
	return vecs, nil
}

type chatReq struct {
	Model       string    `json:"model"`
	Messages    []message `json:"messages"`
	Temperature float32   `json:"temperature"`
}
type message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}
type chatResp struct {
	Choices []struct {
		Message message `json:"message"`
	} `json:"choices"`
	Error *apiErr `json:"error,omitempty"`
}

func (p *OpenAICompatible) Chat(ctx context.Context, system, user string) (string, error) {
	if !p.llmOn {
		return "", ErrDisabled
	}
	var out chatResp
	resp, err := p.http.R().
		SetContext(ctx).
		SetBody(chatReq{
			Model:       p.chatModel,
			Temperature: 0,
			Messages: []message{
				{Role: "system", Content: system},
				{Role: "user", Content: user},
			},
		}).
		SetResult(&out).
		Post("/chat/completions")
	if err != nil {
		return "", err
	}
	if resp.IsError() || out.Error != nil {
		msg := resp.Status()
		if out.Error != nil {
			msg = out.Error.Message
		}
		return "", fmt.Errorf("chat: %s", msg)
	}
	if len(out.Choices) == 0 {
		return "", fmt.Errorf("chat: empty choices")
	}
	return strings.TrimSpace(out.Choices[0].Message.Content), nil
}
