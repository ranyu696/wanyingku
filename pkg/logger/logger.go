package logger

import (
	"log/slog"
	"os"
)

// New 返回一个 slog.Logger 并设为默认。dev 用文本、prod 用 JSON。
func New(env string) *slog.Logger {
	var h slog.Handler
	if env == "prod" {
		h = slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo})
	} else {
		h = slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})
	}
	l := slog.New(h)
	slog.SetDefault(l)
	return l
}
