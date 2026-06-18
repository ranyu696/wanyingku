// Package request 处理「求片」：共享求片单 + 同求计数 + 管理员处理 + 满足后通知。
package request

import (
	"context"
	"errors"
	"strings"

	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/pkg/textutil"
	"gorm.io/gorm"
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

// Create 创建求片。相同片名+年份已存在则「同求 +1」（共享单，登录用户去重）。
func (s *Service) Create(ctx context.Context, uid *int64, name string, year int, kind int16, note string) (*model.Request, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, errors.New("片名不能为空")
	}
	norm := textutil.Normalize(name)
	var existing model.Request
	err := s.db.WithContext(ctx).
		Where("lower(name) = lower(?) AND COALESCE(year, 0) = ?", name, year).
		Order("id ASC").First(&existing).Error
	if err == nil {
		if existing.Status == model.ReqDone {
			return &existing, nil // 已满足
		}
		if uid != nil {
			s.Vote(ctx, existing.ID, *uid, true) // 登录用户：登记投票（去重，不会重复 +1）
		} else {
			s.db.WithContext(ctx).Model(&model.Request{}).Where("id = ?", existing.ID).
				Update("vote_count", gorm.Expr("vote_count + 1")) // 匿名：直接 +1
		}
		fix := map[string]any{}
		if existing.Status == model.ReqRejected {
			fix["status"] = model.ReqPending // 被拒后又有人求 → 重新待处理
		}
		if existing.NormName == "" {
			fix["norm_name"] = norm // 补旧数据
		}
		if len(fix) > 0 {
			s.db.WithContext(ctx).Model(&model.Request{}).Where("id = ?", existing.ID).Updates(fix)
		}
		s.db.WithContext(ctx).First(&existing, existing.ID)
		return &existing, nil
	}
	r := &model.Request{
		UserID: uid, Name: name, Year: year, Kind: kind, Note: note,
		Status: model.ReqPending, VoteCount: 1, NormName: norm,
	}
	if err := s.db.WithContext(ctx).Create(r).Error; err != nil {
		return nil, err
	}
	if uid != nil { // 创建者默认已投（vote_count 已含其 1 票，故只补登记不再 +1）
		s.db.WithContext(ctx).Exec(
			"INSERT INTO request_votes (request_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", r.ID, *uid)
	}
	return r, nil
}

// Vote 顶片：on=true 投票，false 取消。登录用户去重，返回最新票数。
func (s *Service) Vote(ctx context.Context, requestID, uid int64, on bool) (int, bool, error) {
	if on {
		res := s.db.WithContext(ctx).Exec(
			"INSERT INTO request_votes (request_id, user_id) VALUES (?, ?) ON CONFLICT DO NOTHING", requestID, uid)
		if res.Error != nil {
			return 0, false, res.Error
		}
		if res.RowsAffected > 0 {
			s.db.WithContext(ctx).Model(&model.Request{}).Where("id = ?", requestID).
				Update("vote_count", gorm.Expr("vote_count + 1"))
		}
	} else {
		res := s.db.WithContext(ctx).Exec(
			"DELETE FROM request_votes WHERE request_id = ? AND user_id = ?", requestID, uid)
		if res.Error != nil {
			return 0, false, res.Error
		}
		if res.RowsAffected > 0 {
			s.db.WithContext(ctx).Model(&model.Request{}).Where("id = ? AND vote_count > 0", requestID).
				Update("vote_count", gorm.Expr("vote_count - 1"))
		}
	}
	var count int
	s.db.WithContext(ctx).Model(&model.Request{}).Select("vote_count").Where("id = ?", requestID).Scan(&count)
	return count, on, nil
}

// VotedSet 返回 uid 在给定求片里投过票的集合（用于列表 is_voted）。
func (s *Service) VotedSet(ctx context.Context, uid int64, ids []int64) map[int64]bool {
	out := make(map[int64]bool)
	if uid == 0 || len(ids) == 0 {
		return out
	}
	var voted []int64
	s.db.WithContext(ctx).
		Raw("SELECT request_id FROM request_votes WHERE user_id = ? AND request_id IN ?", uid, ids).
		Scan(&voted)
	for _, id := range voted {
		out[id] = true
	}
	return out
}

// List 公开求片单。status<0 表示全部。
func (s *Service) List(ctx context.Context, status, page, size int) ([]model.Request, int64, error) {
	off, lim := paginate(page, size)
	q := s.db.WithContext(ctx).Model(&model.Request{})
	if status >= 0 {
		q = q.Where("status = ?", status)
	}
	var total int64
	q.Count(&total)
	var list []model.Request
	err := q.Order("status ASC, vote_count DESC, created_at DESC").
		Offset(off).Limit(lim).Find(&list).Error
	return list, total, err
}

func (s *Service) MyList(ctx context.Context, uid int64, page, size int) ([]model.Request, int64, error) {
	off, lim := paginate(page, size)
	q := s.db.WithContext(ctx).Model(&model.Request{}).Where("user_id = ?", uid)
	var total int64
	q.Count(&total)
	var list []model.Request
	err := q.Order("created_at DESC").Offset(off).Limit(lim).Find(&list).Error
	return list, total, err
}

// UpdateStatus 管理员处理求片；满足时关联作品并通知发起人。
func (s *Service) UpdateStatus(ctx context.Context, id int64, status int16, titleID *int64, adminNote string) error {
	updates := map[string]any{"status": status, "admin_note": adminNote}
	if titleID != nil {
		updates["title_id"] = *titleID
	}
	if err := s.db.WithContext(ctx).Model(&model.Request{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return err
	}
	if status == model.ReqDone {
		var r model.Request
		if s.db.WithContext(ctx).First(&r, id).Error == nil && r.UserID != nil {
			s.db.WithContext(ctx).Create(&model.Notification{
				UserID: *r.UserID, Kind: 2,
				Title: "求片已满足：" + r.Name,
				Body:  "你求的《" + r.Name + "》已经可以观看了",
				RefID: titleID,
			})
		}
	}
	return nil
}
