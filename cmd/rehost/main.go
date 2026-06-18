// Command rehost 把存量作品的海报/横图转存到自有图床并计算 BlurHash 占位。
// 不重爬采集源；配好 config.yaml 的 storage 段后运行：
//
//	go run ./cmd/rehost            # 处理全部
//	go run ./cmd/rehost -limit 100 -concurrency 8
package main

import (
	"context"
	"flag"
	"fmt"
	"sync"
	"sync/atomic"

	"github.com/xiaoxin/cms/internal/app"
	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/db"
	"github.com/xiaoxin/cms/internal/model"
)

func main() {
	cfgPath := flag.String("config", "config.yaml", "配置文件路径")
	limit := flag.Int("limit", 0, "最多处理多少部，0=全部")
	conc := flag.Int("concurrency", 4, "并发数")
	flag.Parse()

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		panic(err)
	}
	store := app.BuildStorage(cfg)
	if !store.Enabled() {
		fmt.Println("图床未启用。请在 config.yaml 的 storage 段填好 S3 凭证并设 enabled: true")
		return
	}
	gdb, err := db.Open(cfg)
	if err != nil {
		panic(err)
	}

	var titles []model.Title
	q := gdb.Where("poster <> '' OR backdrop <> ''").Order("id")
	if *limit > 0 {
		q = q.Limit(*limit)
	}
	if err := q.Find(&titles).Error; err != nil {
		panic(err)
	}
	fmt.Printf("待处理 %d 部\n", len(titles))

	ctx := context.Background()
	sem := make(chan struct{}, *conc)
	var wg sync.WaitGroup
	var done, changed int32
	for i := range titles {
		wg.Add(1)
		sem <- struct{}{}
		go func(t model.Title) {
			defer wg.Done()
			defer func() { <-sem }()
			updates := map[string]any{}
			if t.Poster != "" {
				if img := store.Rehost(ctx, t.Poster); img.URL != "" && img.URL != t.Poster {
					updates["poster"] = img.URL
					if img.BlurHash != "" {
						updates["poster_blurhash"] = img.BlurHash
					}
				}
			}
			if t.Backdrop != "" {
				if img := store.Rehost(ctx, t.Backdrop); img.URL != "" && img.URL != t.Backdrop {
					updates["backdrop"] = img.URL
					if img.BlurHash != "" {
						updates["backdrop_blurhash"] = img.BlurHash
					}
				}
			}
			if len(updates) > 0 {
				gdb.Model(&model.Title{}).Where("id = ?", t.ID).Updates(updates)
				atomic.AddInt32(&changed, 1)
			}
			if n := atomic.AddInt32(&done, 1); n%50 == 0 {
				fmt.Printf("进度 %d/%d\n", n, len(titles))
			}
		}(titles[i])
	}
	wg.Wait()
	fmt.Printf("完成：处理 %d 部，更新 %d 部\n", done, changed)
}
