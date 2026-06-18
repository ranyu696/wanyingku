// Command renorm 维护命令：用最新归一化规则重算所有作品的 norm_title，
// 并把「同类型 + 同归一化标题 + 年份相近」的重复作品自动合并。
//
//	go run ./cmd/renorm            # dry-run 预览将发生的变化
//	go run ./cmd/renorm -apply     # 实际执行
package main

import (
	"context"
	"flag"
	"fmt"
	"sort"

	"github.com/xiaoxin/cms/internal/config"
	"github.com/xiaoxin/cms/internal/db"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/internal/repository"
	"github.com/xiaoxin/cms/internal/service/resolve"
	"github.com/xiaoxin/cms/pkg/textutil"
)

func main() {
	cfgPath := flag.String("config", "config.yaml", "配置文件路径")
	yearTol := flag.Int("year-tol", 1, "合并的年份容差")
	fuzzy := flag.Float64("fuzzy", 0.86, "模糊合并相似度阈值（0 关闭，textutil.Similarity）")
	apply := flag.Bool("apply", false, "实际执行（默认 dry-run 仅打印）")
	flag.Parse()

	cfg, err := config.Load(*cfgPath)
	if err != nil {
		panic(err)
	}
	gdb, err := db.Open(cfg)
	if err != nil {
		panic(err)
	}
	repo := repository.New(gdb)
	ctx := context.Background()

	var titles []model.Title
	if err := gdb.Find(&titles).Error; err != nil {
		panic(err)
	}

	// 1) 重算 norm_title + season
	changed := 0
	for i := range titles {
		nn := textutil.Normalize(titles[i].Name)
		ss := int16(textutil.ParseSeason(titles[i].Name))
		if nn != titles[i].NormTitle || ss != titles[i].Season {
			if *apply {
				gdb.Model(&model.Title{}).Where("id = ?", titles[i].ID).
					Updates(map[string]any{"norm_title": nn, "season": ss})
			}
			titles[i].NormTitle = nn
			titles[i].Season = ss
			changed++
		}
	}
	fmt.Printf("重算 norm_title/season：%d 处变化%s\n", changed, dryNote(*apply))

	// 2) 分组找重复并合并（同 kind + 同 norm + 同 season，norm 长度>=2）
	type key struct {
		kind   int16
		norm   string
		season int16
	}
	groups := map[key][]model.Title{}
	for _, t := range titles {
		if len([]rune(t.NormTitle)) < 2 {
			continue
		}
		k := key{t.Kind, t.NormTitle, t.Season}
		groups[k] = append(groups[k], t)
	}

	gone := map[int64]bool{} // 已被合并掉的 id（pass2/pass3 共享，避免重复处理）
	merges := 0
	for _, g := range groups {
		if len(g) < 2 {
			continue
		}
		keeper := g[0]
		for _, t := range g[1:] {
			if t.SourceCount > keeper.SourceCount ||
				(t.SourceCount == keeper.SourceCount && t.ID < keeper.ID) {
				keeper = t
			}
		}
		for _, t := range g {
			if t.ID == keeper.ID {
				continue
			}
			if keeper.Year > 0 && t.Year > 0 &&
				absInt(keeper.Year-t.Year) > resolve.YearTolFor(keeper.Kind, *yearTol) {
				continue // 电影/剧年份差太大可能是翻拍，跳过；动漫等放宽
			}
			fmt.Printf("合并 #%d《%s》(%d) -> #%d《%s》(%d) [norm=%s]%s\n",
				t.ID, t.Name, t.Year, keeper.ID, keeper.Name, keeper.Year, keeper.NormTitle, dryNote(*apply))
			if *apply {
				if err := repo.MergeTitles(ctx, t.ID, keeper.ID); err != nil {
					fmt.Printf("  合并失败: %v\n", err)
				}
			}
			gone[t.ID] = true
			merges++
		}
	}
	fmt.Printf("精确归一合并 %d 部%s\n", merges, dryNote(*apply))

	// 3) 模糊合并：同 kind+season 桶内，textutil.Similarity ≥ 阈值（含子串包含）的近似重复。
	//    pg_trgm 对中文失效，采集期模糊层历史上没生效，故存量里有不少差一点的重复，这里补救。
	fuzMerges := 0
	if *fuzzy > 0 {
		type bk struct {
			kind   int16
			season int16
		}
		buckets := map[bk][]model.Title{}
		for _, t := range titles {
			if gone[t.ID] || len([]rune(t.NormTitle)) < 3 {
				continue
			}
			buckets[bk{t.Kind, t.Season}] = append(buckets[bk{t.Kind, t.Season}], t)
		}
		for _, b := range buckets {
			// 优先把源多/id 小的当 keeper
			sort.Slice(b, func(i, j int) bool {
				if b[i].SourceCount != b[j].SourceCount {
					return b[i].SourceCount > b[j].SourceCount
				}
				return b[i].ID < b[j].ID
			})
			var keepers []model.Title
			for _, t := range b {
				if gone[t.ID] {
					continue
				}
				matched := false
				for _, k := range keepers {
					if k.Year > 0 && t.Year > 0 &&
						absInt(k.Year-t.Year) > resolve.YearTolFor(k.Kind, *yearTol) {
						continue
					}
					if textutil.DifferentInstallment(k.NormTitle, t.NormTitle) {
						continue // 尾号不同的续作/季，不合并
					}
					if textutil.Similarity(k.NormTitle, t.NormTitle) >= *fuzzy {
						fmt.Printf("模糊合并 #%d《%s》(%d) -> #%d《%s》(%d) [sim=%.2f]%s\n",
							t.ID, t.Name, t.Year, k.ID, k.Name, k.Year,
							textutil.Similarity(k.NormTitle, t.NormTitle), dryNote(*apply))
						if *apply {
							if err := repo.MergeTitles(ctx, t.ID, k.ID); err != nil {
								fmt.Printf("  合并失败: %v\n", err)
							}
						}
						gone[t.ID] = true
						fuzMerges++
						matched = true
						break
					}
				}
				if !matched {
					keepers = append(keepers, t)
				}
			}
		}
	}
	fmt.Printf("模糊合并 %d 部%s\n", fuzMerges, dryNote(*apply))
	if !*apply {
		fmt.Println("（dry-run，加 -apply 实际执行）")
	}
}

func dryNote(apply bool) string {
	if apply {
		return ""
	}
	return " [dry-run]"
}

func absInt(a int) int {
	if a < 0 {
		return -a
	}
	return a
}
