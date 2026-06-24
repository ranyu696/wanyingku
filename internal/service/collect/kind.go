package collect

import (
	"strings"

	"github.com/xiaoxin/cms/internal/model"
)

// shortDramaEpMin 微短剧最小分集阈值：被判电影但分集 ≥ 此数 → 纠正为短剧。
// 电影/电影合集不会有这么多集；源常把微短剧挂在「电影」或泛题材下，靠集数兜底纠偏。
const shortDramaEpMin = 20

// guessKindMatched 由 type_name 推断类型；matched=false 表示没命中任何媒介标记、落到了默认(电影)。
func guessKindMatched(typeName string) (int16, bool) {
	s := strings.TrimSpace(typeName)
	switch {
	case strings.Contains(s, "里番"): // 成人动漫归入动漫（另由 IsAdult 打成人标记）
		return model.KindAnime, true
	case strings.Contains(s, "动漫"), strings.Contains(s, "动画"):
		return model.KindAnime, true
	case strings.Contains(s, "综艺"):
		return model.KindVariety, true
	case strings.Contains(s, "纪录"):
		return model.KindDoc, true
	case strings.Contains(s, "短剧"):
		return model.KindShort, true
	case strings.Contains(s, "足球"), strings.Contains(s, "篮球"), strings.Contains(s, "网球"),
		strings.Contains(s, "斯诺克"), strings.Contains(s, "LPL"), strings.Contains(s, "体育"),
		strings.Contains(s, "赛事"), strings.Contains(s, "世界杯"), strings.Contains(s, "联赛"),
		strings.Contains(s, "滇超"):
		return model.KindSports, true
	case strings.Contains(s, "电视"), strings.Contains(s, "连续剧"),
		strings.Contains(s, "国产剧"), strings.Contains(s, "港台剧"),
		strings.Contains(s, "日韩剧"), strings.Contains(s, "欧美剧"),
		strings.Contains(s, "海外剧"), strings.HasSuffix(s, "剧"):
		return model.KindTV, true
	case strings.Contains(s, "电影"), strings.Contains(s, "片"):
		return model.KindMovie, true
	default:
		return model.KindMovie, false
	}
}

// GuessKind 由采集源的 type_name 推断作品类型（叶子级）。
func GuessKind(typeName string) int16 {
	k, _ := guessKindMatched(typeName)
	return k
}

// ClassifyKind 叶子优先：叶子能确定类型就用叶子（如「短剧」即便源把它挂在「连续剧」下也算短剧）；
// 叶子是泛题材、落到默认(电影)时，再用顶级分类兜底（如「现代都市」挂在「短剧大全」下 → 短剧）。
func ClassifyKind(leaf, root string) int16 {
	if k, ok := guessKindMatched(leaf); ok {
		return k
	}
	if root != "" && root != leaf {
		if k, ok := guessKindMatched(root); ok {
			return k
		}
	}
	return model.KindMovie
}

// FixShortByEpisodes 短剧纠偏：被判电影但分集数 ≥ shortDramaEpMin → 纠正为短剧；其余原样。
// 源常把微短剧挂在「电影」或泛题材下(落到默认电影)，但电影/合集不会有几十上百集。
func FixShortByEpisodes(kind int16, episodes int) int16 {
	if kind == model.KindMovie && episodes >= shortDramaEpMin {
		return model.KindShort
	}
	return kind
}

// IsJunkType 纯噪声类型（新闻资讯/预告片/娱乐新闻），不入库。
func IsJunkType(typeName string) bool {
	s := strings.TrimSpace(typeName)
	for _, kw := range []string{"新闻", "资讯", "预告"} {
		if strings.Contains(s, kw) {
			return true
		}
	}
	return false
}

// IsAdult 由 type_name 判断是否成人内容（伦理片/里番/三级/情色）。
// 这类仍按 GuessKind 归入电影/动漫，但会打上 adult 标记，前端海报默认打码不直显。
func IsAdult(typeName string) bool {
	s := strings.TrimSpace(typeName)
	for _, kw := range []string{"里番", "伦理", "倫理", "三级", "三級", "情色", "成人", "福利"} {
		if strings.Contains(s, kw) {
			return true
		}
	}
	return false
}
