// Package middleware 提供鉴权等 Echo 中间件。
package middleware

import (
	"strings"

	"github.com/labstack/echo/v4"
	"github.com/xiaoxin/cms/pkg/jwtutil"
	"github.com/xiaoxin/cms/pkg/response"
)

const (
	CtxUID  = "uid"
	CtxRole = "role"
)

func bearer(c echo.Context) string {
	h := c.Request().Header.Get("Authorization")
	if strings.HasPrefix(h, "Bearer ") {
		return strings.TrimSpace(h[7:])
	}
	return ""
}

// JWTAuth 强制登录。
func JWTAuth(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			tok := bearer(c)
			if tok == "" {
				return response.Unauthorized(c, "未登录")
			}
			claims, err := jwtutil.Parse(secret, tok)
			if err != nil {
				return response.Unauthorized(c, "登录已失效")
			}
			c.Set(CtxUID, claims.UserID)
			c.Set(CtxRole, claims.Role)
			return next(c)
		}
	}
}

// OptionalAuth 可选登录（匿名也放行，用于个性化但不强制的接口）。
func OptionalAuth(secret string) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			if tok := bearer(c); tok != "" {
				if claims, err := jwtutil.Parse(secret, tok); err == nil {
					c.Set(CtxUID, claims.UserID)
					c.Set(CtxRole, claims.Role)
				}
			}
			return next(c)
		}
	}
}

// AdminOnly 需在 JWTAuth 之后使用。
func AdminOnly() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			role, _ := c.Get(CtxRole).(int16)
			if role != 1 {
				return response.Forbidden(c, "需要管理员权限")
			}
			return next(c)
		}
	}
}

// UID 从上下文取用户 id，未登录返回 0。
func UID(c echo.Context) int64 {
	id, _ := c.Get(CtxUID).(int64)
	return id
}
