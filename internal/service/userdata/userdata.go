// Package userdata 管理收藏、观看历史/进度、订阅、站内通知。
package userdata

import (
	"context"

	"github.com/xiaoxin/cms/internal/model"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Service struct {
	db *gorm.DB
}

func New(db *gorm.DB) *Service { return &Service{db: db} }

func paginate(page, size int) (int, int) {
	if page < 1 {
		page = 1
	}
	if size < 1 || size > 60 {
		size = 24
	}
	return (page - 1) * size, size
}

// ---- 收藏 ----

func (s *Service) AddFavorite(ctx context.Context, uid, titleID int64) error {
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).
		Create(&model.Favorite{UserID: uid, TitleID: titleID}).Error
}

func (s *Service) RemoveFavorite(ctx context.Context, uid, titleID int64) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND title_id = ?", uid, titleID).Delete(&model.Favorite{}).Error
}

func (s *Service) ListFavorites(ctx context.Context, uid int64, page, size int) ([]model.Favorite, int64, error) {
	off, lim := paginate(page, size)
	q := s.db.WithContext(ctx).Model(&model.Favorite{}).Where("user_id = ?", uid)
	var total int64
	q.Count(&total)
	var list []model.Favorite
	err := q.Preload("Title").Order("created_at DESC").Offset(off).Limit(lim).Find(&list).Error
	return list, total, err
}

func (s *Service) IsFavorite(ctx context.Context, uid, titleID int64) bool {
	var n int64
	s.db.WithContext(ctx).Model(&model.Favorite{}).
		Where("user_id = ? AND title_id = ?", uid, titleID).Count(&n)
	return n > 0
}

// ---- 观看历史/进度 ----

type ProgressInput struct {
	TitleID      int64  `json:"title_id"`
	PlaySourceID *int64 `json:"play_source_id"`
	EpisodeID    *int64 `json:"episode_id"`
	EpisodeIdx   int    `json:"episode_idx"`
	Position     int    `json:"position"`
	Duration     int    `json:"duration"`
}

func (s *Service) SaveProgress(ctx context.Context, uid int64, in ProgressInput) error {
	h := &model.WatchHistory{
		UserID: uid, TitleID: in.TitleID, PlaySourceID: in.PlaySourceID,
		EpisodeID: in.EpisodeID, EpisodeIdx: in.EpisodeIdx, Position: in.Position, Duration: in.Duration,
	}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "user_id"}, {Name: "title_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"play_source_id", "episode_id", "episode_idx", "position", "duration", "updated_at",
		}),
	}).Create(h).Error
}

func (s *Service) ListHistory(ctx context.Context, uid int64, page, size int) ([]model.WatchHistory, int64, error) {
	off, lim := paginate(page, size)
	q := s.db.WithContext(ctx).Model(&model.WatchHistory{}).Where("user_id = ?", uid)
	var total int64
	q.Count(&total)
	var list []model.WatchHistory
	err := q.Preload("Title").Order("updated_at DESC").Offset(off).Limit(lim).Find(&list).Error
	return list, total, err
}

func (s *Service) DeleteHistory(ctx context.Context, uid, titleID int64) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND title_id = ?", uid, titleID).Delete(&model.WatchHistory{}).Error
}

// ---- 订阅更新 ----

func (s *Service) Subscribe(ctx context.Context, uid, titleID int64) error {
	var t model.Title
	if err := s.db.WithContext(ctx).Select("latest_episode").First(&t, titleID).Error; err != nil {
		return err
	}
	return s.db.WithContext(ctx).Clauses(clause.OnConflict{DoNothing: true}).
		Create(&model.Subscription{UserID: uid, TitleID: titleID, LastNotifiedEpisode: t.LatestEpisode}).Error
}

func (s *Service) Unsubscribe(ctx context.Context, uid, titleID int64) error {
	return s.db.WithContext(ctx).
		Where("user_id = ? AND title_id = ?", uid, titleID).Delete(&model.Subscription{}).Error
}

func (s *Service) ListSubscriptions(ctx context.Context, uid int64, page, size int) ([]model.Subscription, int64, error) {
	off, lim := paginate(page, size)
	q := s.db.WithContext(ctx).Model(&model.Subscription{}).Where("user_id = ?", uid)
	var total int64
	q.Count(&total)
	var list []model.Subscription
	err := q.Preload("Title").Order("created_at DESC").Offset(off).Limit(lim).Find(&list).Error
	return list, total, err
}

func (s *Service) IsSubscribed(ctx context.Context, uid, titleID int64) bool {
	var n int64
	s.db.WithContext(ctx).Model(&model.Subscription{}).
		Where("user_id = ? AND title_id = ?", uid, titleID).Count(&n)
	return n > 0
}

// ---- 通知 ----

func (s *Service) ListNotifications(ctx context.Context, uid int64, page, size int) ([]model.Notification, int64, error) {
	off, lim := paginate(page, size)
	q := s.db.WithContext(ctx).Model(&model.Notification{}).Where("user_id = ?", uid)
	var total int64
	q.Count(&total)
	var list []model.Notification
	err := q.Order("created_at DESC").Offset(off).Limit(lim).Find(&list).Error
	return list, total, err
}

func (s *Service) UnreadCount(ctx context.Context, uid int64) int64 {
	var n int64
	s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND is_read = false", uid).Count(&n)
	return n
}

func (s *Service) MarkRead(ctx context.Context, uid, id int64) error {
	return s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND id = ?", uid, id).Update("is_read", true).Error
}

func (s *Service) MarkAllRead(ctx context.Context, uid int64) error {
	return s.db.WithContext(ctx).Model(&model.Notification{}).
		Where("user_id = ? AND is_read = false", uid).Update("is_read", true).Error
}

// ---- 观看进度（续播） ----

func (s *Service) GetProgress(ctx context.Context, uid, titleID int64) (*model.WatchHistory, error) {
	var h model.WatchHistory
	err := s.db.WithContext(ctx).
		Where("user_id = ? AND title_id = ?", uid, titleID).First(&h).Error
	if err != nil {
		return nil, err
	}
	return &h, nil
}

// ---- 作品点赞 ----

func (s *Service) LikeTitle(ctx context.Context, uid, titleID int64, on bool) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if on {
			res := tx.Exec(`INSERT INTO title_likes(title_id, user_id) VALUES(?, ?) ON CONFLICT DO NOTHING`, titleID, uid)
			if res.RowsAffected > 0 {
				tx.Exec(`UPDATE titles SET like_count = like_count + 1 WHERE id = ?`, titleID)
			}
		} else {
			res := tx.Exec(`DELETE FROM title_likes WHERE title_id = ? AND user_id = ?`, titleID, uid)
			if res.RowsAffected > 0 {
				tx.Exec(`UPDATE titles SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?`, titleID)
			}
		}
		return nil
	})
}

func (s *Service) IsTitleLiked(ctx context.Context, uid, titleID int64) bool {
	var n int64
	s.db.WithContext(ctx).Table("title_likes").
		Where("title_id = ? AND user_id = ?", titleID, uid).Count(&n)
	return n > 0
}

// ---- 评论 ----

func (s *Service) ListComments(ctx context.Context, titleID, uid int64, page, size int) ([]model.Comment, int64, error) {
	off, lim := paginate(page, size)
	q := s.db.WithContext(ctx).Model(&model.Comment{}).Where("title_id = ?", titleID)
	var total int64
	q.Count(&total)
	var list []model.Comment
	if err := q.Preload("User").Order("created_at DESC").Offset(off).Limit(lim).Find(&list).Error; err != nil {
		return nil, 0, err
	}
	if uid > 0 && len(list) > 0 {
		ids := make([]int64, len(list))
		for i, c := range list {
			ids[i] = c.ID
		}
		var liked []int64
		s.db.WithContext(ctx).Table("comment_likes").
			Where("user_id = ? AND comment_id IN ?", uid, ids).Pluck("comment_id", &liked)
		set := make(map[int64]bool, len(liked))
		for _, id := range liked {
			set[id] = true
		}
		for i := range list {
			list[i].IsLiked = set[list[i].ID]
		}
	}
	return list, total, nil
}

func (s *Service) AddComment(ctx context.Context, uid, titleID int64, content string) (*model.Comment, error) {
	c := &model.Comment{TitleID: titleID, UserID: uid, Content: content}
	if err := s.db.WithContext(ctx).Create(c).Error; err != nil {
		return nil, err
	}
	s.db.WithContext(ctx).Preload("User").First(c, c.ID)
	return c, nil
}

func (s *Service) DeleteComment(ctx context.Context, uid, commentID int64) error {
	return s.db.WithContext(ctx).
		Where("id = ? AND user_id = ?", commentID, uid).Delete(&model.Comment{}).Error
}

func (s *Service) LikeComment(ctx context.Context, uid, commentID int64, on bool) error {
	return s.db.WithContext(ctx).Transaction(func(tx *gorm.DB) error {
		if on {
			res := tx.Exec(`INSERT INTO comment_likes(comment_id, user_id) VALUES(?, ?) ON CONFLICT DO NOTHING`, commentID, uid)
			if res.RowsAffected > 0 {
				tx.Exec(`UPDATE comments SET like_count = like_count + 1 WHERE id = ?`, commentID)
			}
		} else {
			res := tx.Exec(`DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?`, commentID, uid)
			if res.RowsAffected > 0 {
				tx.Exec(`UPDATE comments SET like_count = GREATEST(like_count - 1, 0) WHERE id = ?`, commentID)
			}
		}
		return nil
	})
}
