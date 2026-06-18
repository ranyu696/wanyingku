//go:build dbtest

// 真实数据库的去重引擎集成测试（按需运行，自动清理）：
//
//	go test -tags dbtest ./internal/service/resolve/ -run TestEngineDedup -v
package resolve

import (
	"context"
	"os"
	"testing"

	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/pkg/aiprovider"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

func TestEngineDedup(t *testing.T) {
	dsn := os.Getenv("YINSHI_DSN")
	if dsn == "" {
		dsn = "host=localhost user=xiaoxin dbname=yinshi port=5432 sslmode=disable TimeZone=Asia/Shanghai"
	}
	gdb, err := gorm.Open(postgres.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Skipf("无法连接数据库，跳过: %v", err)
	}

	eng := New(gdb, nil, aiprovider.Noop{}, config.Resolve{
		FuzzyThreshold: 0.42, AutoMergeThreshold: 0.86, LLMReviewLow: 0.62, YearTolerance: 1, EnableTMDB: false,
	}, config.AI{})

	ctx := context.Background()
	var cleanup []int64
	defer func() {
		for _, id := range cleanup {
			gdb.Exec("DELETE FROM titles WHERE id = ?", id)
		}
	}()

	resolve := func(name string, year int) int64 {
		r, err := eng.Resolve(ctx, Input{Name: name, Kind: model.KindMovie, Year: year})
		if err != nil {
			t.Fatalf("resolve %q: %v", name, err)
		}
		return r.TitleID
	}

	// 同一部片的三种写法（不同语种/版本/副标题）应合并为同一个 title
	id1 := resolve("复仇者联盟4（国语版）", 2019)
	cleanup = append(cleanup, id1)
	if id2 := resolve("复仇者联盟4 2019 HD", 2019); id2 != id1 {
		t.Errorf("精确归一化层应合并: id1=%d id2=%d", id1, id2)
	}
	if id3 := resolve("复仇者联盟4：终局之战", 2019); id3 != id1 {
		t.Errorf("模糊层应合并副标题写法: id1=%d id3=%d", id1, id3)
	}

	// 不同影片不应合并
	id4 := resolve("误杀", 2019)
	cleanup = append(cleanup, id4)
	if id4 == id1 {
		t.Errorf("不同影片被错误合并: %d", id4)
	}

	t.Logf("✓ 去重通过：复仇者联盟4 三种写法 -> title %d；误杀 -> title %d", id1, id4)
}
