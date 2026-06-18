package textutil

import (
	"html"
	"regexp"
	"strings"
)

var (
	// 块级/换行标签 → 转成换行（保留段落结构）
	reBlockBreak = regexp.MustCompile(`(?i)<\s*/?\s*(p|br|div|li|tr|h[1-6])\b[^>]*>`)
	// 其余一切标签 → 直接剥离
	reAnyTag = regexp.MustCompile(`<[^>]+>`)
	// 行内连续空白（含 &nbsp; 反转义后的  ）合并成单个空格
	reInlineSpace = regexp.MustCompile(`[ \t\x{00a0}]+`)
	// 三个及以上连续换行塌成一个空行
	reBlankLines = regexp.MustCompile(`\n{3,}`)
)

// CleanHTML 把采集源里夹带 HTML 的简介（<p>…</p>、<br/>、&nbsp; 等）压成干净纯文本：
// 块级/换行标签转换行 → 剥离其余标签 → 反转义 HTML 实体 → 规范空白。
// 不含 < 与 & 的纯文本只做首尾裁剪，零开销直接返回。
func CleanHTML(s string) string {
	if !strings.ContainsAny(s, "<&") {
		return strings.TrimSpace(s)
	}
	s = reBlockBreak.ReplaceAllString(s, "\n")
	s = reAnyTag.ReplaceAllString(s, "")
	s = html.UnescapeString(s)
	s = reInlineSpace.ReplaceAllString(s, " ")
	lines := strings.Split(s, "\n")
	for i, ln := range lines {
		lines[i] = strings.TrimSpace(ln)
	}
	s = reBlankLines.ReplaceAllString(strings.Join(lines, "\n"), "\n\n")
	return strings.TrimSpace(s)
}
