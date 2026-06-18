// Command seed 初始化数据：创建管理员、添加采集源。
//
//	go run ./cmd/seed -admin-user admin -admin-pass admin123
//	go run ./cmd/seed -source-name 示例源 -source-url https://host/api.php/provide/vod/
package main

import (
	"flag"
	"fmt"
	"log/slog"

	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/db"
	"github.com/xiaoxin/cms/internal/model"
	"golang.org/x/crypto/bcrypt"
)

func main() {
	cfgPath := flag.String("config", "config.yaml", "配置文件路径")
	adminUser := flag.String("admin-user", "", "创建/更新管理员用户名")
	adminPass := flag.String("admin-pass", "", "管理员密码")
	srcName := flag.String("source-name", "", "采集源名称")
	srcURL := flag.String("source-url", "", "采集源接口地址")
	srcWeight := flag.Int("source-weight", 0, "采集源权重")
	flag.Parse()

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		panic(err)
	}
	gdb, err := db.Open(cfg)
	if err != nil {
		panic(err)
	}

	if *adminUser != "" && *adminPass != "" {
		hash, _ := bcrypt.GenerateFromPassword([]byte(*adminPass), bcrypt.DefaultCost)
		u := model.User{Username: *adminUser, PasswordHash: string(hash), Nickname: *adminUser, Role: 1, Status: 1}
		err := gdb.Where("username = ?", *adminUser).Assign(map[string]any{
			"password_hash": string(hash), "role": 1, "status": 1,
		}).FirstOrCreate(&u).Error
		if err != nil {
			slog.Error("create admin failed", "err", err)
		} else {
			fmt.Printf("✓ 管理员就绪: %s (id=%d, role=1)\n", u.Username, u.ID)
		}
	}

	if *srcName != "" && *srcURL != "" {
		s := model.Source{Name: *srcName, APIURL: *srcURL, APIType: 1, Enabled: true, Weight: *srcWeight, SyncIntervalMin: 720}
		err := gdb.Where("api_url = ?", *srcURL).Assign(map[string]any{
			"name": *srcName, "enabled": true, "weight": *srcWeight,
		}).FirstOrCreate(&s).Error
		if err != nil {
			slog.Error("create source failed", "err", err)
		} else {
			fmt.Printf("✓ 采集源就绪: %s (id=%d)\n", s.Name, s.ID)
		}
	}

	if *adminUser == "" && *srcName == "" {
		fmt.Println("用法: -admin-user/-admin-pass 创建管理员；-source-name/-source-url 添加采集源")
	}
}
