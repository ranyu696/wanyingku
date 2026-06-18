// Package push 通过 Firebase Cloud Messaging 把站内通知推送到设备。
// 未配置凭证时整体降级为 no-op（Enabled()=false），调用方无需判空。
package push

import (
	"context"
	"log/slog"

	firebase "firebase.google.com/go/v4"
	"firebase.google.com/go/v4/messaging"
	"google.golang.org/api/option"
	"gorm.io/gorm"

	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/model"
)

type Service struct {
	db     *gorm.DB
	client *messaging.Client
}

// New 初始化 FCM。未启用/凭证缺失返回 client=nil 的 Service（Enabled()=false），不报错只记日志。
func New(ctx context.Context, db *gorm.DB, cfg config.Push) (*Service, error) {
	s := &Service{db: db}
	if !cfg.Enabled || cfg.CredentialsFile == "" {
		slog.Info("fcm push disabled (no credentials)")
		return s, nil
	}
	app, err := firebase.NewApp(ctx, nil, option.WithCredentialsFile(cfg.CredentialsFile))
	if err != nil {
		return s, err
	}
	client, err := app.Messaging(ctx)
	if err != nil {
		return s, err
	}
	s.client = client
	slog.Info("fcm push enabled")
	return s, nil
}

func (s *Service) Enabled() bool { return s != nil && s.client != nil }

// SaveToken 注册/更新设备令牌。token 唯一：同一设备换登录账号时归属随之更新。
func (s *Service) SaveToken(ctx context.Context, uid int64, token, platform string) error {
	if token == "" {
		return nil
	}
	if platform == "" {
		platform = "android"
	}
	return s.db.WithContext(ctx).Exec(`
		INSERT INTO device_tokens (user_id, token, platform, created_at, updated_at)
		VALUES (?, ?, ?, now(), now())
		ON CONFLICT (token) DO UPDATE SET user_id = EXCLUDED.user_id, platform = EXCLUDED.platform, updated_at = now()`,
		uid, token, platform).Error
}

// DeleteToken 注销设备令牌（登出/卸载）。
func (s *Service) DeleteToken(ctx context.Context, token string) error {
	return s.db.WithContext(ctx).Where("token = ?", token).Delete(&model.DeviceToken{}).Error
}

// SendToUser 给某用户所有设备推送（失效令牌自动清理）。未启用时静默跳过。
func (s *Service) SendToUser(ctx context.Context, uid int64, title, body string, data map[string]string) {
	if !s.Enabled() {
		return
	}
	var tokens []string
	s.db.WithContext(ctx).Model(&model.DeviceToken{}).Where("user_id = ?", uid).Pluck("token", &tokens)
	if len(tokens) == 0 {
		return
	}
	resp, err := s.client.SendEachForMulticast(ctx, &messaging.MulticastMessage{
		Tokens:       tokens,
		Notification: &messaging.Notification{Title: title, Body: body},
		Data:         data,
	})
	if err != nil {
		slog.Warn("fcm send failed", "uid", uid, "err", err)
		return
	}
	var stale []string
	for i, r := range resp.Responses {
		if r.Success || r.Error == nil {
			continue
		}
		if messaging.IsUnregistered(r.Error) ||
			messaging.IsRegistrationTokenNotRegistered(r.Error) ||
			messaging.IsInvalidArgument(r.Error) {
			stale = append(stale, tokens[i])
		}
	}
	if len(stale) > 0 {
		s.db.WithContext(ctx).Where("token IN ?", stale).Delete(&model.DeviceToken{})
		slog.Info("fcm pruned stale tokens", "uid", uid, "count", len(stale))
	}
}
