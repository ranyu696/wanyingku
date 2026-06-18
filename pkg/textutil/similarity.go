package textutil

import (
	"regexp"
	"strings"
)

var reTrailNum = regexp.MustCompile(`\d+$`)

// DifferentInstallment 判断两个归一化标题是否很可能是同一系列的不同部/季/续作，不该合并：
//  1. 去掉尾部数字后相同、但尾部数字不同（「沧元图」vs「沧元图3」、「斗罗大陆2」vs「斗罗大陆」）；
//  2. 一个是另一个的前缀、且多出来的部分以数字开头（「寒门小状元」vs「寒门小状元2之名扬天下」——续作带副标题）。
func DifferentInstallment(a, b string) bool {
	na := reTrailNum.FindString(a)
	nb := reTrailNum.FindString(b)
	if na != nb && strings.TrimSuffix(a, na) == strings.TrimSuffix(b, nb) {
		return true
	}
	short, long := a, b
	if len(a) > len(b) {
		short, long = b, a
	}
	if short != "" && short != long && strings.HasPrefix(long, short) {
		rest := long[len(short):]
		if rest != "" && rest[0] >= '0' && rest[0] <= '9' {
			return true
		}
	}
	return false
}

// trigrams 生成带边界填充的三元组集合（近似 pg_trgm 语义，按 rune 处理中文）。
func trigrams(s string) map[string]struct{} {
	r := []rune("  " + s + " ")
	set := make(map[string]struct{})
	if len(r) < 3 {
		if s != "" {
			set[s] = struct{}{}
		}
		return set
	}
	for i := 0; i+3 <= len(r); i++ {
		set[string(r[i:i+3])] = struct{}{}
	}
	return set
}

// Similarity 返回 [0,1] 的标题相似度，给 TMDB 候选排序用。
// 综合：完全相等=1；含子串关系给高分；否则三元组 Jaccard。
func Similarity(a, b string) float64 {
	if a == "" || b == "" {
		return 0
	}
	if a == b {
		return 1
	}
	// 子串包含（如「复仇者联盟4」⊂「复仇者联盟4终局之战」）
	short, long := a, b
	if len([]rune(a)) > len([]rune(b)) {
		short, long = b, a
	}
	if strings.Contains(long, short) {
		ratio := float64(len([]rune(short))) / float64(len([]rune(long)))
		if ratio < 0.5 {
			ratio = 0.5
		}
		// 含子串给 0.75~0.95
		return 0.75 + 0.20*ratio
	}
	ta, tb := trigrams(a), trigrams(b)
	if len(ta) == 0 || len(tb) == 0 {
		return 0
	}
	inter := 0
	for k := range ta {
		if _, ok := tb[k]; ok {
			inter++
		}
	}
	union := len(ta) + len(tb) - inter
	if union == 0 {
		return 0
	}
	return float64(inter) / float64(union)
}
