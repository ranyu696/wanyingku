// Package douban 用 querydata.org（WMDB 豆瓣数据）按片名补充中文元数据与豆瓣评分。
// 公共免费接口，限流不稳：调用方需重限流 + best-effort。
package douban

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
	"github.com/xiaoxin/cms/internal/model"
	"github.com/xiaoxin/cms/pkg/textutil"
	"gorm.io/gorm"
)

const searchURL = "https://api.querydata.org/api/v1/movie/search"

type Client struct{ http *resty.Client }

func New(timeout time.Duration, ua string) *Client {
	if ua == "" {
		ua = "Mozilla/5.0"
	}
	return &Client{http: resty.New().SetTimeout(timeout).SetHeader("User-Agent", ua).
		SetRetryCount(2).SetRetryWaitTime(2 * time.Second)}
}

// Result 豆瓣置信匹配结果。
type Result struct {
	DoubanID   string
	Rating     float32
	Votes      int
	Year       int
	Aliases    []string
	NameCn     string
	GenreCn    string
	OverviewCn string
}

type apiResp struct {
	Data []apiItem `json:"data"`
}

type apiItem struct {
	DoubanID     string    `json:"doubanId"`
	DoubanRating string    `json:"doubanRating"` // 字符串，可能为空
	DoubanVotes  int       `json:"doubanVotes"`
	Year         string    `json:"year"` // 字符串
	OriginalName string    `json:"originalName"`
	Alias        string    `json:"alias"`
	Langs        []apiLang `json:"data"`
}

type apiLang struct {
	Name        string `json:"name"`
	Genre       string `json:"genre"`
	Description string `json:"description"`
	Lang        string `json:"lang"`
}

// SearchByName 按片名（可带年份）搜豆瓣，返回置信匹配（中文名精确相等 + 年份相近）；
// 无置信匹配返回 nil,nil（宁缺勿错，避免错配评分）。
func (c *Client) SearchByName(ctx context.Context, name string, year int) (*Result, error) {
	name = strings.TrimSpace(name)
	if name == "" {
		return nil, nil
	}
	q := map[string]string{"q": name, "limit": "5", "lang": "Cn"}
	if year > 0 {
		q["year"] = strconv.Itoa(year)
	}
	var out apiResp
	resp, err := c.http.R().SetContext(ctx).SetQueryParams(q).
		ForceContentType("application/json").SetResult(&out).Get(searchURL)
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, fmt.Errorf("douban search http %d", resp.StatusCode())
	}

	// 归一比对：中文名/原名/别名 任一归一后等于查询名即视为同片；多个候选取年份最接近。
	want := textutil.Normalize(name)
	var best *apiItem
	var bestCn *apiLang
	bestYearDiff := 1 << 30
	for i := range out.Data {
		it := &out.Data[i]
		cn := pickLang(it.Langs, "Cn")
		names := []string{it.OriginalName}
		if cn != nil {
			names = append(names, cn.Name)
		}
		names = append(names, splitAliases(it.Alias)...)
		matched := false
		for _, n := range names {
			if textutil.Normalize(n) == want {
				matched = true
				break
			}
		}
		if !matched {
			continue
		}
		itYear := parseYear(it.Year)
		diff := 1 << 29
		if year > 0 && itYear > 0 {
			diff = abs(itYear - year)
		}
		if diff < bestYearDiff {
			best, bestCn, bestYearDiff = it, cn, diff
		}
	}
	if best == nil {
		return nil, nil
	}
	itYear := parseYear(best.Year)
	rating, _ := strconv.ParseFloat(strings.TrimSpace(best.DoubanRating), 32)
	r := &Result{
		DoubanID: best.DoubanID, Rating: float32(rating), Votes: best.DoubanVotes,
		Year: itYear, Aliases: splitAliases(best.Alias),
	}
	if bestCn != nil {
		r.NameCn, r.GenreCn, r.OverviewCn = bestCn.Name, bestCn.Genre, bestCn.Description
	}
	return r, nil
}

func pickLang(ls []apiLang, lang string) *apiLang {
	for i := range ls {
		if ls[i].Lang == lang {
			return &ls[i]
		}
	}
	return nil
}

func splitAliases(s string) []string {
	out := []string{}
	for _, p := range strings.FieldsFunc(s, func(r rune) bool { return r == '/' || r == '、' || r == ',' }) {
		if p = strings.TrimSpace(p); p != "" {
			out = append(out, p)
		}
	}
	return out
}

func abs(x int) int {
	if x < 0 {
		return -x
	}
	return x
}

var reYear = regexp.MustCompile(`(19|20)\d{2}`)

// parseYear 从 "1996–" / "2021" 这类字符串里取 4 位年份。
func parseYear(s string) int {
	m := reYear.FindString(s)
	if m == "" {
		return 0
	}
	y, _ := strconv.Atoi(m)
	return y
}

// Enricher 豆瓣增强：限流地给作品补豆瓣评分/id（best-effort，宁缺勿错）。
type Enricher struct {
	db     *gorm.DB
	client *Client
	delay  time.Duration
}

func NewEnricher(db *gorm.DB, ua string, delayMs int) *Enricher {
	if delayMs < 500 {
		delayMs = 1500 // 默认 1.5s 限流，避免被公共接口封
	}
	return &Enricher{db: db, client: New(12*time.Second, ua), delay: time.Duration(delayMs) * time.Millisecond}
}

// EnrichMissing 对尚无豆瓣评分的作品逐个增强（limit<=0 表示全部）。返回 处理数/命中数。
func (e *Enricher) EnrichMissing(ctx context.Context, limit int) (processed, matched int) {
	var titles []model.Title
	// 成人内容(里番/伦理)不匹配豆瓣：豆瓣只收录主流片，按名匹配会把里番挂到同名主流条目、盗其评分
	q := e.db.WithContext(ctx).Where("status = 1 AND douban_id = '' AND adult = false").Order("popularity DESC")
	if limit > 0 {
		q = q.Limit(limit)
	}
	q.Find(&titles)
	slog.Info("douban enrich start", "targets", len(titles), "delay", e.delay.String())
	for i := range titles {
		select {
		case <-ctx.Done():
			return
		default:
		}
		t := &titles[i]
		res, err := e.client.SearchByName(ctx, t.Name, t.Year)
		processed++
		if err == nil && res != nil && res.DoubanID != "" {
			updates := map[string]any{
				"douban_id":     res.DoubanID,
				"douban_rating": res.Rating,
				"douban_votes":  res.Votes,
			}
			// 中文简介：仅当本地为空时补（不覆盖 TMDB 已有中文简介）
			if strings.TrimSpace(t.Overview) == "" && strings.TrimSpace(res.OverviewCn) != "" {
				updates["overview"] = res.OverviewCn
			}
			e.db.WithContext(ctx).Model(&model.Title{}).Where("id = ?", t.ID).Updates(updates)
			// 中文译名 + 豆瓣别名 → 入 title_aliases（去重，利于搜索召回）
			e.addAliases(ctx, t.ID, append([]string{res.NameCn}, res.Aliases...))
			matched++
		}
		if e.delay > 0 && i < len(titles)-1 {
			time.Sleep(e.delay)
		}
	}
	slog.Info("douban enrich done", "processed", processed, "matched", matched)
	return
}

// addAliases 把豆瓣中文译名/别名去重写入 title_aliases（来源标记 AliasFromDouban）。
func (e *Enricher) addAliases(ctx context.Context, titleID int64, names []string) {
	seen := map[string]bool{}
	for _, n := range names {
		n = strings.TrimSpace(n)
		if n == "" {
			continue
		}
		na := textutil.Normalize(n)
		if na == "" || seen[na] {
			continue
		}
		seen[na] = true
		e.db.WithContext(ctx).Exec(
			`INSERT INTO title_aliases(title_id, alias, norm_alias, lang, source)
			 VALUES (?, ?, ?, ?, ?) ON CONFLICT (title_id, norm_alias) DO NOTHING`,
			titleID, n, na, textutil.DetectLang(n), model.AliasFromDouban)
	}
}
