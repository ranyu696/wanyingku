package textutil

import (
	"regexp"
	"strconv"
)

var (
	reSeasonNumCN = regexp.MustCompile(`第([0-9〇零一二三四五六七八九十百两]+)季`)
	reSeasonNumEN = regexp.MustCompile(`(?i)(?:season|\bs)\s*(\d{1,3})`)
)

var cnDigit = map[rune]int{
	'零': 0, '〇': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
	'五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
}

// cnToInt 解析「十二」「二十四」「3」等为整数（支持到百，覆盖季号场景）。
func cnToInt(s string) int {
	if n, err := strconv.Atoi(s); err == nil {
		return n
	}
	total, section := 0, 0
	for _, c := range s {
		switch {
		case c == '十':
			if section == 0 {
				section = 1
			}
			section *= 10
			total += section
			section = 0
		case c == '百':
			if section == 0 {
				section = 1
			}
			section *= 100
			total += section
			section = 0
		default:
			if d, ok := cnDigit[c]; ok {
				section = d
			}
		}
	}
	return total + section
}

// ParseSeason 从标题解析季号（第N季 / Season N / SN），无则 0。
func ParseSeason(name string) int {
	s := toHalfWidth(name)
	if m := reSeasonNumCN.FindStringSubmatch(s); len(m) > 1 {
		if n := cnToInt(m[1]); n > 0 {
			return n
		}
	}
	if m := reSeasonNumEN.FindStringSubmatch(s); len(m) > 1 {
		if n, _ := strconv.Atoi(m[1]); n > 0 {
			return n
		}
	}
	return 0
}
