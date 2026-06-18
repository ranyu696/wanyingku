package collect

import (
	"strconv"
	"strings"
)

// flexStr 兼容 JSON 里「字符串/数字」混用的字段。
type flexStr string

func (f *flexStr) UnmarshalJSON(b []byte) error {
	s := strings.TrimSpace(string(b))
	if s == "" || s == "null" {
		*f = ""
		return nil
	}
	s = strings.Trim(s, `"`)
	*f = flexStr(s)
	return nil
}

// flexInt 兼容 JSON 里「字符串/数字/浮点」混用的整型字段。
type flexInt int

func (f *flexInt) UnmarshalJSON(b []byte) error {
	s := strings.Trim(strings.TrimSpace(string(b)), `"`)
	if s == "" || s == "null" {
		*f = 0
		return nil
	}
	if n, err := strconv.Atoi(s); err == nil {
		*f = flexInt(n)
		return nil
	}
	if ff, err := strconv.ParseFloat(s, 64); err == nil {
		*f = flexInt(int(ff))
	}
	return nil
}

func (f flexInt) Int() int { return int(f) }
