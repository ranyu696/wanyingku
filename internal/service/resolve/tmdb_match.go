package resolve

import (
	"context"
	"math"

	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/pkg/textutil"
	"github.com/xiaoxin/cms/pkg/tmdb"
)

// tmdbMatch 在 TMDB 搜索候选里挑出最可能的同一部，返回 (tmdbID, 置信度, 是否剧集)。
func (e *Engine) tmdbMatch(ctx context.Context, in Input) (int, float32, bool) {
	// 短剧 TMDB 没有收录，任何命中都是误匹配（会带错题材），直接跳过。
	if in.Kind == model.KindShort {
		return 0, 0, true
	}
	clean := textutil.CleanName(in.Name)
	if clean == "" {
		clean = in.Name
	}
	isTV := in.Kind != model.KindMovie

	var results []tmdb.SearchResult
	if isTV {
		results, _ = e.tmdb.SearchTV(ctx, clean, in.Year)
		if len(results) == 0 && in.Year > 0 {
			results, _ = e.tmdb.SearchTV(ctx, clean, 0)
		}
	} else {
		results, _ = e.tmdb.SearchMovie(ctx, clean, in.Year)
		if len(results) == 0 && in.Year > 0 {
			results, _ = e.tmdb.SearchMovie(ctx, clean, 0)
		}
	}
	if len(results) == 0 {
		return 0, 0, isTV
	}

	bestID := 0
	bestScore := 0.0
	limit := len(results)
	if limit > 5 {
		limit = 5
	}
	for _, r := range results[:limit] {
		cn := textutil.Normalize(r.DisplayName())
		on := textutil.Normalize(r.OrigName())
		sc := math.Max(textutil.Similarity(cn, in.NormTitle), textutil.Similarity(on, in.NormTitle))
		if in.Year > 0 && r.Year() > 0 {
			if absInt(in.Year-r.Year()) <= e.cfg.YearTolerance {
				sc += 0.08
			} else {
				sc -= 0.15
			}
		}
		if sc > bestScore {
			bestScore = sc
			bestID = r.ID
		}
	}
	if bestScore < 0.55 {
		return 0, 0, isTV
	}
	if bestScore > 1 {
		bestScore = 1
	}
	return bestID, float32(bestScore), isTV
}
