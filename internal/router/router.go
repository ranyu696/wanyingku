// Package router 装配 HTTP 路由。
package router

import (
	"net/http"

	"github.com/labstack/echo/v4"
	emw "github.com/labstack/echo/v4/middleware"
	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/handler"
	mw "github.com/xiaoxin/cms/internal/middleware"
)

func Setup(cfg *config.Config, h *handler.Handler) *echo.Echo {
	e := echo.New()
	e.HideBanner = true
	e.Use(emw.Recover())
	e.Use(emw.Logger())
	e.Use(emw.CORSWithConfig(emw.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{http.MethodGet, http.MethodPost, http.MethodPut, http.MethodDelete, http.MethodOptions},
		AllowHeaders: []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAuthorization},
	}))

	e.GET("/healthz", func(c echo.Context) error { return c.String(http.StatusOK, "ok") })

	secret := cfg.App.JWTSecret
	g := e.Group(cfg.App.APIPrefix)

	// 图片分发：私有桶预签名重定向（公开、无需登录）
	g.GET("/img/*", h.ImageProxy)

	// 公开接口（可选登录：登录后返回个性化字段）
	pub := g.Group("", mw.OptionalAuth(secret))
	pub.POST("/auth/register", h.Register)
	pub.POST("/auth/login", h.Login)
	pub.GET("/home", h.Home)
	pub.GET("/titles", h.ListTitles)
	pub.GET("/titles/:id", h.GetTitle)
	pub.GET("/titles/:id/related", h.RelatedTitles)
	pub.GET("/people", h.PersonTitles)
	pub.GET("/collections", h.Collections)
	pub.GET("/collections/:key", h.CollectionTitles)
	pub.GET("/titles/:id/comments", h.ListComments)
	pub.GET("/search", h.Search)
	pub.GET("/search/hot", h.HotSearches)
	pub.GET("/titles/random", h.RandomTitle)
	pub.GET("/tags", h.Tags)
	pub.GET("/genres", h.Genres)
	pub.GET("/requests", h.ListRequests)
	pub.GET("/sitemap", h.Sitemap)

	// 需登录
	auth := g.Group("", mw.JWTAuth(secret))
	auth.GET("/me", h.Me)
	auth.GET("/me/favorites", h.ListFavorites)
	auth.POST("/me/favorites", h.AddFavorite)
	auth.DELETE("/me/favorites/:id", h.RemoveFavorite)
	auth.GET("/me/history", h.ListHistory)
	auth.POST("/me/history", h.SaveProgress)
	auth.DELETE("/me/history/:id", h.DeleteHistory)
	auth.GET("/me/recommend", h.Recommend)
	auth.GET("/me/subscriptions", h.ListSubscriptions)
	auth.POST("/me/subscriptions", h.Subscribe)
	auth.DELETE("/me/subscriptions/:id", h.Unsubscribe)
	auth.GET("/me/notifications", h.ListNotifications)
	auth.GET("/me/notifications/unread", h.UnreadCount)
	auth.POST("/me/push-token", h.RegisterPushToken)
	auth.DELETE("/me/push-token", h.UnregisterPushToken)
	auth.POST("/me/notifications/:id/read", h.MarkRead)
	auth.POST("/me/notifications/read-all", h.MarkAllRead)
	auth.POST("/requests", h.CreateRequest)
	auth.GET("/me/requests", h.MyRequests)
	auth.POST("/requests/:id/vote", h.VoteRequest)
	auth.DELETE("/requests/:id/vote", h.UnvoteRequest)
	// 评论 / 点赞
	auth.POST("/comments", h.AddComment)
	auth.DELETE("/comments/:id", h.DeleteComment)
	auth.POST("/comments/:id/like", h.LikeComment)
	auth.DELETE("/comments/:id/like", h.UnlikeComment)
	auth.POST("/titles/:id/like", h.LikeTitle)
	auth.DELETE("/titles/:id/like", h.UnlikeTitle)
	auth.POST("/titles/:id/skip", h.SubmitSkip)

	// 管理后台
	admin := g.Group("/admin", mw.JWTAuth(secret), mw.AdminOnly())
	// 重操作限流：reindex / sync-all / 单源同步，防误触/滥用打爆 Meili 与采集源
	heavy := emw.RateLimiter(emw.NewRateLimiterMemoryStore(1))
	admin.GET("/sources", h.ListSources)
	admin.GET("/source-health", h.SourceHealthStats)
	admin.POST("/reindex", h.AdminReindex, heavy)
	admin.POST("/sources", h.CreateSource)
	admin.PUT("/sources/:id", h.UpdateSource)
	admin.DELETE("/sources/:id", h.DeleteSource)
	admin.POST("/sources/:id/sync", h.SyncSource, heavy)
	admin.POST("/sync-all", h.SyncAll, heavy)
	admin.GET("/review", h.ReviewList)
	admin.POST("/titles/merge", h.MergeTitles)
	admin.GET("/requests", h.ListAdminRequests)
	admin.PUT("/requests/:id", h.UpdateRequest)
	admin.GET("/stats", h.Stats)
	// 数据管理
	admin.GET("/titles", h.AdminListTitles)
	admin.GET("/titles/:id", h.AdminGetTitle)
	admin.PUT("/titles/:id", h.AdminUpdateTitle)
	admin.DELETE("/titles/:id", h.AdminDeleteTitle)
	admin.GET("/source-items", h.AdminListSourceItems)
	admin.GET("/users", h.AdminListUsers)
	admin.PUT("/users/:id", h.AdminUpdateUser)

	return e
}
