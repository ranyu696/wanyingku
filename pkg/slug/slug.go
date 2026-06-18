// Package slug 把（中文）片名转成 URL 友好的拼音 slug，如「地球人实在太凶猛了」→ diqiuren-shizai-taixiongmengle。
package slug

import (
	"regexp"
	"strings"

	"github.com/mozillazg/go-pinyin"
)

var dashRuns = regexp.MustCompile(`-+`)

// Make 生成拼音 slug：汉字逐字转拼音，拉丁字母/数字原样保留，其余作分隔，全小写、合并连字符。
// 无法生成（纯符号等）时返回空串，调用方应回退到数字 id。
func Make(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return ""
	}
	a := pinyin.NewArgs() // 默认 Normal：无声调、小写
	var b strings.Builder
	for _, r := range name {
		switch {
		case r >= 0x4e00 && r <= 0x9fff: // CJK 统一汉字
			py := pinyin.SinglePinyin(r, a)
			if len(py) > 0 {
				b.WriteString(py[0])
				b.WriteByte('-')
			} else {
				b.WriteByte('-')
			}
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			b.WriteRune(r)
		case r >= 'A' && r <= 'Z':
			b.WriteRune(r + 32) // 转小写
		default:
			b.WriteByte('-')
		}
	}
	s := dashRuns.ReplaceAllString(b.String(), "-")
	return strings.Trim(s, "-")
}
