// Package auth 处理注册/登录与 JWT 签发。
package auth

import (
	"context"
	"errors"
	"strings"

	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/pkg/jwtutil"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

var (
	ErrUserExists    = errors.New("用户名已存在")
	ErrBadCredential = errors.New("用户名或密码错误")
)

type Service struct {
	db       *gorm.DB
	secret   string
	expHours int
}

func New(db *gorm.DB, secret string, expHours int) *Service {
	return &Service{db: db, secret: secret, expHours: expHours}
}

type AuthResult struct {
	Token string      `json:"token"`
	User  *model.User `json:"user"`
}

func (s *Service) Register(ctx context.Context, username, password, nickname string) (*AuthResult, error) {
	username = strings.TrimSpace(username)
	if len(username) < 3 || len(password) < 6 {
		return nil, errors.New("用户名至少3位、密码至少6位")
	}
	var count int64
	s.db.WithContext(ctx).Model(&model.User{}).Where("username = ?", username).Count(&count)
	if count > 0 {
		return nil, ErrUserExists
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return nil, err
	}
	if nickname == "" {
		nickname = username
	}
	u := &model.User{Username: username, PasswordHash: string(hash), Nickname: nickname, Status: 1}
	if err := s.db.WithContext(ctx).Create(u).Error; err != nil {
		return nil, err
	}
	return s.issue(u)
}

func (s *Service) Login(ctx context.Context, username, password string) (*AuthResult, error) {
	var u model.User
	if err := s.db.WithContext(ctx).Where("username = ?", strings.TrimSpace(username)).First(&u).Error; err != nil {
		return nil, ErrBadCredential
	}
	if u.Status != 1 {
		return nil, errors.New("账号已禁用")
	}
	if bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password)) != nil {
		return nil, ErrBadCredential
	}
	return s.issue(&u)
}

func (s *Service) issue(u *model.User) (*AuthResult, error) {
	token, err := jwtutil.Generate(s.secret, u.ID, u.Role, s.expHours)
	if err != nil {
		return nil, err
	}
	return &AuthResult{Token: token, User: u}, nil
}
