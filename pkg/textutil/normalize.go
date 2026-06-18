// Package textutil 提供标题归一化，是去重归类引擎的第一道处理：
// 把「复仇者联盟4（国语版）2019 HD」这类带语种/版本/年份/季标记的脏标题，
// 压成可比对的紧凑形式「复仇者联盟4」，供 TMDB 别名匹配与 pg_trgm 模糊召回使用。
package textutil

import (
	"regexp"
	"strconv"
	"strings"
)

// 语种/版本/清晰度等装饰性词（多字，避免误伤正片标题里的单字）。
var decorations = []string{
	"国语版", "粤语版", "英语版", "日语版", "韩语版", "国语", "粤语", "英语", "日语", "韩语", "泰语", "原声",
	"中字", "双语", "中英双字", "中英字幕", "简中", "繁中", "简体", "繁体", "无删减", "未删减",
	"完整版", "完结版", "加长版", "导演剪辑版", "剧场版", "纪念版", "重制版", "抢先版", "枪版", "高清版",
	"超清", "蓝光", "1080p", "2160p", "720p", "480p", "4k", "bluray", "webrip", "hdrip", "dvdrip",
	"hdtv", "web-dl", "remux", "hdr", "dolby",
}

// 单独出现的版本短标记（作为独立 token 才剥离，避免误伤）。
var decorationTokens = map[string]bool{
	"hd": true, "bd": true, "ts": true, "tc": true, "hc": true, "hr": true, "dvd": true,
	"web": true, "uhd": true,
}

var langTags = []struct{ key, val string }{
	{"国语", "国语"}, {"普通话", "国语"}, {"国配", "国语"}, {"华语", "国语"},
	{"粤语", "粤语"}, {"英语", "英语"}, {"日语", "日语"}, {"韩语", "韩语"}, {"原声", "原声"}, {"中字", "中字"},
}

var (
	reBracket  = regexp.MustCompile(`[（(【\[][^）)】\]]*[）)】\]]`)
	reYearCN   = regexp.MustCompile(`(19|20)\d{2}\s*年`)
	reYear     = regexp.MustCompile(`(19|20)\d{2}`)
	reSeasonCN = regexp.MustCompile(`第[0-9零一二三四五六七八九十百千]+[季部]`)
	reSeasonEN = regexp.MustCompile(`(?i)\b(season|s)\s*\d{1,3}\b`)
	rePartEN   = regexp.MustCompile(`(?i)\b(part|cour|chapter|vol)[\s._-]*\d{1,3}\b`) // Part 3 / Cour2
	rePartCN   = regexp.MustCompile(`第[0-9零一二三四五六七八九十]+[部篇章]分?`)              // 第3部分 / 第二篇
	reKeep     = regexp.MustCompile(`[^\p{Han}\p{Latin}\p{N}]+`)                     // 仅保留 汉字/拉丁/数字
)

func toHalfWidth(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	for _, r := range s {
		switch {
		case r == 0x3000:
			b.WriteRune(' ')
		case r >= 0xFF01 && r <= 0xFF5E:
			b.WriteRune(r - 0xFEE0)
		default:
			b.WriteRune(r)
		}
	}
	return b.String()
}

// Normalize 生成用于匹配的紧凑归一化标题。
func Normalize(name string) string {
	s := toHalfWidth(name)
	s = strings.ToLower(s)
	s = reBracket.ReplaceAllString(s, " ")
	s = reYearCN.ReplaceAllString(s, " ")
	s = rePartCN.ReplaceAllString(s, " ") // 先剥「第N部分/篇/章」，避免被季规则的"部"吃掉
	s = reSeasonCN.ReplaceAllString(s, " ")
	s = reSeasonEN.ReplaceAllString(s, " ")
	s = rePartEN.ReplaceAllString(s, " ")
	for _, d := range decorations {
		s = strings.ReplaceAll(s, d, " ")
	}
	// 去掉独立的短版本 token
	for tok := range decorationTokens {
		s = regexp.MustCompile(`(?i)\b`+tok+`\b`).ReplaceAllString(s, " ")
	}
	s = reYear.ReplaceAllString(s, " ")
	s = reKeep.ReplaceAllString(s, "")
	return strings.TrimSpace(s)
}

// CleanName 生成用于展示的干净标题（保留可读结构，仅去版本/年份装饰）。
func CleanName(name string) string {
	s := toHalfWidth(name)
	s = reBracket.ReplaceAllString(s, " ")
	for _, d := range decorations {
		s = strings.ReplaceAll(s, d, " ")
	}
	s = strings.Join(strings.Fields(s), " ")
	return strings.TrimSpace(s)
}

// DetectLang 从原始标题/备注中识别语种/版本。
func DetectLang(name string) string {
	s := toHalfWidth(name)
	for _, t := range langTags {
		if strings.Contains(s, t.key) {
			return t.val
		}
	}
	return ""
}

// ExtractYear 从文本里提取 4 位年份，取不到返回 0。
func ExtractYear(text string) int {
	m := reYear.FindString(toHalfWidth(text))
	if m == "" {
		return 0
	}
	y, _ := strconv.Atoi(m)
	if y < 1900 || y > 2100 {
		return 0
	}
	return y
}

// ParseEpisodeNo 从「第01集 / 第1话 / EP05 / 01」里取集号，取不到返回 0。
var reEp = regexp.MustCompile(`(?i)(?:第|ep|e)?\s*0*(\d{1,4})\s*(?:集|话|期)?`)

func ParseEpisodeNo(name string) int {
	m := reEp.FindStringSubmatch(strings.TrimSpace(toHalfWidth(name)))
	if len(m) < 2 {
		return 0
	}
	n, _ := strconv.Atoi(m[1])
	return n
}
