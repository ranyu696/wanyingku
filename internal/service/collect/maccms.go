// Package collect 实现苹果CMS(MacCMS) 资源站采集与解析。
package collect

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
)

// MacCMSClient 是 MacCMS JSON 采集接口客户端。
type MacCMSClient struct {
	http *resty.Client
}

func NewMacCMSClient(timeout time.Duration, ua string) *MacCMSClient {
	c := resty.New().
		SetTimeout(timeout).
		SetHeader("User-Agent", ua).
		SetRetryCount(2).
		SetRetryWaitTime(800 * time.Millisecond)
	return &MacCMSClient{http: c}
}

// ListOptions 采集分页/筛选参数。
type ListOptions struct {
	Action  string // videolist(默认) | detail
	Page    int
	Hours   int    // h：仅取最近 N 小时更新（增量）
	TypeID  int    // t：按源 type_id 过滤
	Keyword string // wd：关键字
	IDs     string // ids：detail 模式按 id 批量取
}

// ListResp MacCMS 列表响应。
type ListResp struct {
	Code      int         `json:"code"`
	Msg       string      `json:"msg"`
	Page      flexInt     `json:"page"`
	PageCount flexInt     `json:"pagecount"`
	Limit     flexInt     `json:"limit"`
	Total     flexInt     `json:"total"`
	List      []VodItem   `json:"list"`
	Class     []ClassItem `json:"class"` // 分类树（type_pid 指向父级），用顶级分类判定 kind
}

// ClassItem 采集源的分类节点（如「现代都市」pid 指向「短剧大全」）。
type ClassItem struct {
	TypeID   flexInt `json:"type_id"`
	TypePid  flexInt `json:"type_pid"`
	TypeName string  `json:"type_name"`
}

// RootCategories 由分类树构建 type_id → 顶级分类名 的映射（沿 type_pid 上溯到 pid=0）。
func RootCategories(class []ClassItem) map[int]string {
	byID := make(map[int]ClassItem, len(class))
	for _, c := range class {
		byID[c.TypeID.Int()] = c
	}
	roots := make(map[int]string, len(class))
	for _, c := range class {
		cur := c
		for i := 0; i < 8 && cur.TypePid.Int() != 0; i++ { // 上溯到顶级，限步防环
			p, ok := byID[cur.TypePid.Int()]
			if !ok {
				break
			}
			cur = p
		}
		roots[c.TypeID.Int()] = cur.TypeName
	}
	return roots
}

// VodItem 单条采集记录（字段对齐 MacCMS10）。
type VodItem struct {
	VodID       flexStr `json:"vod_id"`
	TypeID      flexInt `json:"type_id"`
	TypeName    string  `json:"type_name"`
	VodName     string  `json:"vod_name"`
	VodSub      string  `json:"vod_sub"`
	VodEn       string  `json:"vod_en"`
	VodYear     flexStr `json:"vod_year"`
	VodArea     string  `json:"vod_area"`
	VodLang     string  `json:"vod_lang"`
	VodRemarks  string  `json:"vod_remarks"`
	VodActor    string  `json:"vod_actor"`
	VodDirector string  `json:"vod_director"`
	VodContent  string  `json:"vod_content"`
	VodPic      string  `json:"vod_pic"`
	VodClass    string  `json:"vod_class"`
	VodPlayFrom string  `json:"vod_play_from"`
	VodPlayURL  string  `json:"vod_play_url"`
	VodTime     string  `json:"vod_time"`
}

func (v VodItem) Year() int {
	y, _ := strconv.Atoi(strings.TrimSpace(string(v.VodYear)))
	if y < 1900 || y > 2100 {
		return 0
	}
	return y
}

// FetchList 拉取一页采集数据。
func (c *MacCMSClient) FetchList(ctx context.Context, apiURL string, opt ListOptions) (*ListResp, error) {
	action := opt.Action
	if action == "" {
		action = "videolist"
	}
	q := map[string]string{"ac": action}
	if opt.Page > 0 {
		q["pg"] = strconv.Itoa(opt.Page)
	}
	if opt.Hours > 0 {
		q["h"] = strconv.Itoa(opt.Hours)
	}
	if opt.TypeID > 0 {
		q["t"] = strconv.Itoa(opt.TypeID)
	}
	if opt.Keyword != "" {
		q["wd"] = opt.Keyword
	}
	if opt.IDs != "" {
		q["ids"] = opt.IDs
	}

	var out ListResp
	resp, err := c.http.R().
		SetContext(ctx).
		SetQueryParams(q).
		ForceContentType("application/json"). // 多数 maccms 返回 text/html 头但内容是 JSON
		SetResult(&out).
		Get(apiURL)
	if err != nil {
		return nil, fmt.Errorf("maccms fetch %s: %w", apiURL, err)
	}
	if resp.IsError() {
		return nil, fmt.Errorf("maccms fetch %s: http %d", apiURL, resp.StatusCode())
	}
	if out.Code != 1 && out.Code != 0 && len(out.List) == 0 {
		return nil, fmt.Errorf("maccms response code=%d msg=%s", out.Code, out.Msg)
	}
	return &out, nil
}

// ---- 播放地址解析 ----

// PlayGroup 一条线路（对应一个 vod_play_from flag）。
type PlayGroup struct {
	Flag     string
	Episodes []ParsedEpisode
}

// ParsedEpisode 一集（名称 + 播放地址）。
type ParsedEpisode struct {
	Name string
	URL  string
}

// ParsePlay 解析 vod_play_from / vod_play_url：
// flag 以 $$$ 分隔，集以 # 分隔，"名称$地址" 以首个 $ 分隔。
func ParsePlay(playFrom, playURL string) []PlayGroup {
	flags := strings.Split(playFrom, "$$$")
	groups := strings.Split(playURL, "$$$")
	out := make([]PlayGroup, 0, len(groups))
	for i, g := range groups {
		flag := ""
		if i < len(flags) {
			flag = strings.TrimSpace(flags[i])
		}
		var eps []ParsedEpisode
		for _, raw := range strings.Split(g, "#") {
			raw = strings.TrimSpace(raw)
			if raw == "" {
				continue
			}
			name, url := "", raw
			if idx := strings.Index(raw, "$"); idx >= 0 {
				name = strings.TrimSpace(raw[:idx])
				url = strings.TrimSpace(raw[idx+1:])
			}
			if url == "" || !looksLikeURL(url) {
				continue
			}
			if name == "" {
				name = "第" + strconv.Itoa(len(eps)+1) + "集"
			}
			eps = append(eps, ParsedEpisode{Name: name, URL: url})
		}
		if len(eps) == 0 {
			continue
		}
		out = append(out, PlayGroup{Flag: flag, Episodes: eps})
	}
	return out
}

func looksLikeURL(s string) bool {
	return strings.HasPrefix(s, "http://") || strings.HasPrefix(s, "https://") ||
		strings.Contains(s, ".m3u8") || strings.Contains(s, ".mp4")
}

// ParseVodTime 解析 MacCMS 的时间字符串。
func ParseVodTime(s string) *time.Time {
	s = strings.TrimSpace(s)
	if s == "" {
		return nil
	}
	layouts := []string{"2006-01-02 15:04:05", "2006-01-02T15:04:05", "2006-01-02"}
	loc, _ := time.LoadLocation("Asia/Shanghai")
	for _, l := range layouts {
		if t, err := time.ParseInLocation(l, s, loc); err == nil {
			return &t
		}
	}
	return nil
}
