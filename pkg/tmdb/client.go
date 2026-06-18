// Package tmdb 是 TMDB v3 客户端。归类引擎用它作为「规范作品」的权威来源：
// 通过 alternative_titles / translations 把不同语种、不同译名都聚到同一个 TMDB id。
package tmdb

import (
	"context"
	"fmt"
	"strconv"
	"strings"
	"time"

	"github.com/go-resty/resty/v2"
)

type Client struct {
	http      *resty.Client
	key       string
	bearer    bool
	lang      string
	region    string
	imageBase string
}

func New(apiKey, baseURL, imageBase, lang, region, proxy string, timeout time.Duration) *Client {
	h := resty.New().
		SetBaseURL(strings.TrimRight(baseURL, "/")).
		SetTimeout(timeout).
		SetRetryCount(2).
		SetRetryWaitTime(time.Second)
	if proxy != "" {
		h.SetProxy(proxy)
	}
	c := &Client{http: h, key: apiKey, lang: lang, region: region, imageBase: strings.TrimRight(imageBase, "/")}
	// v4 token 是长 JWT（含 "."），用 Bearer；否则按 v3 api_key 走查询参数。
	if strings.Count(apiKey, ".") >= 2 {
		c.bearer = true
		h.SetAuthToken(apiKey)
	}
	return c
}

func (c *Client) q(extra map[string]string) map[string]string {
	m := map[string]string{"language": c.lang}
	if c.region != "" {
		m["region"] = c.region
	}
	if !c.bearer {
		m["api_key"] = c.key
	}
	for k, v := range extra {
		m[k] = v
	}
	return m
}

// SearchResult 搜索结果项（movie/tv 字段统一）。
type SearchResult struct {
	ID            int     `json:"id"`
	Title         string  `json:"title"`          // movie
	Name          string  `json:"name"`           // tv
	OriginalTitle string  `json:"original_title"` // movie
	OriginalName  string  `json:"original_name"`  // tv
	ReleaseDate   string  `json:"release_date"`   // movie
	FirstAirDate  string  `json:"first_air_date"` // tv
	Overview      string  `json:"overview"`
	PosterPath    string  `json:"poster_path"`
	BackdropPath  string  `json:"backdrop_path"`
	GenreIDs      []int   `json:"genre_ids"`
	Popularity    float32 `json:"popularity"`
	VoteAverage   float32 `json:"vote_average"`
	VoteCount     int     `json:"vote_count"`
}

func (r SearchResult) DisplayName() string {
	if r.Title != "" {
		return r.Title
	}
	return r.Name
}

func (r SearchResult) OrigName() string {
	if r.OriginalTitle != "" {
		return r.OriginalTitle
	}
	return r.OriginalName
}

func (r SearchResult) Year() int {
	d := r.ReleaseDate
	if d == "" {
		d = r.FirstAirDate
	}
	if len(d) >= 4 {
		y, _ := strconv.Atoi(d[:4])
		return y
	}
	return 0
}

type searchResp struct {
	Results []SearchResult `json:"results"`
}

func (c *Client) SearchMovie(ctx context.Context, query string, year int) ([]SearchResult, error) {
	extra := map[string]string{"query": query, "include_adult": "false"}
	if year > 0 {
		extra["year"] = strconv.Itoa(year)
	}
	return c.search(ctx, "/search/movie", extra)
}

func (c *Client) SearchTV(ctx context.Context, query string, year int) ([]SearchResult, error) {
	extra := map[string]string{"query": query, "include_adult": "false"}
	if year > 0 {
		extra["first_air_date_year"] = strconv.Itoa(year)
	}
	return c.search(ctx, "/search/tv", extra)
}

func (c *Client) search(ctx context.Context, path string, extra map[string]string) ([]SearchResult, error) {
	var out searchResp
	resp, err := c.http.R().SetContext(ctx).SetQueryParams(c.q(extra)).SetResult(&out).Get(path)
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, fmt.Errorf("tmdb %s: http %d", path, resp.StatusCode())
	}
	return out.Results, nil
}

// Detail 详情（含别名/译名/外部 id/题材）。
type Detail struct {
	ID               int     `json:"id"`
	Title            string  `json:"title"`
	Name             string  `json:"name"`
	OriginalTitle    string  `json:"original_title"`
	OriginalName     string  `json:"original_name"`
	Overview         string  `json:"overview"`
	Tagline          string  `json:"tagline"`
	ReleaseDate      string  `json:"release_date"`
	FirstAirDate     string  `json:"first_air_date"`
	PosterPath       string  `json:"poster_path"`
	BackdropPath     string  `json:"backdrop_path"`
	Runtime          int     `json:"runtime"`
	Popularity       float32 `json:"popularity"`
	VoteAverage      float32 `json:"vote_average"`
	VoteCount        int     `json:"vote_count"`
	IMDbID           string  `json:"imdb_id"`
	NumberOfEpisodes int     `json:"number_of_episodes"`
	EpisodeRunTime   []int   `json:"episode_run_time"`
	Status           string  `json:"status"`
	Genres           []struct {
		ID   int    `json:"id"`
		Name string `json:"name"`
	} `json:"genres"`
	OriginCountry       []string `json:"origin_country"`
	OriginalLanguage    string   `json:"original_language"`
	ProductionCountries []struct {
		ISO  string `json:"iso_3166_1"`
		Name string `json:"name"`
	} `json:"production_countries"`
	AlternativeTitles struct {
		Titles  []altTitle `json:"titles"`  // movie
		Results []altTitle `json:"results"` // tv
	} `json:"alternative_titles"`
	Translations struct {
		Translations []struct {
			ISO  string `json:"iso_639_1"`
			Data struct {
				Title string `json:"title"`
				Name  string `json:"name"`
			} `json:"data"`
		} `json:"translations"`
	} `json:"translations"`
	ExternalIDs struct {
		IMDbID string `json:"imdb_id"`
		TVDBID int    `json:"tvdb_id"`
	} `json:"external_ids"`
}

type altTitle struct {
	ISO   string `json:"iso_3166_1"`
	Title string `json:"title"`
	Type  string `json:"type"`
}

func (d Detail) DisplayName() string {
	if d.Title != "" {
		return d.Title
	}
	return d.Name
}

func (d Detail) OrigName() string {
	if d.OriginalTitle != "" {
		return d.OriginalTitle
	}
	return d.OriginalName
}

func (d Detail) Year() int {
	x := d.ReleaseDate
	if x == "" {
		x = d.FirstAirDate
	}
	if len(x) >= 4 {
		y, _ := strconv.Atoi(x[:4])
		return y
	}
	return 0
}

func (d Detail) IMDb() string {
	if d.IMDbID != "" {
		return d.IMDbID
	}
	return d.ExternalIDs.IMDbID
}

// AllAliases 汇总所有可用于匹配/搜索的名称（去重前）。
func (d Detail) AllAliases() []string {
	var names []string
	push := func(s string) {
		s = strings.TrimSpace(s)
		if s != "" {
			names = append(names, s)
		}
	}
	push(d.Title)
	push(d.Name)
	push(d.OriginalTitle)
	push(d.OriginalName)
	for _, a := range d.AlternativeTitles.Titles {
		push(a.Title)
	}
	for _, a := range d.AlternativeTitles.Results {
		push(a.Title)
	}
	for _, t := range d.Translations.Translations {
		push(t.Data.Title)
		push(t.Data.Name)
	}
	return names
}

func (c *Client) MovieDetail(ctx context.Context, id int) (*Detail, error) {
	return c.detail(ctx, fmt.Sprintf("/movie/%d", id))
}

func (c *Client) TVDetail(ctx context.Context, id int) (*Detail, error) {
	return c.detail(ctx, fmt.Sprintf("/tv/%d", id))
}

func (c *Client) detail(ctx context.Context, path string) (*Detail, error) {
	var out Detail
	extra := map[string]string{"append_to_response": "alternative_titles,translations,external_ids"}
	resp, err := c.http.R().SetContext(ctx).SetQueryParams(c.q(extra)).SetResult(&out).Get(path)
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, fmt.Errorf("tmdb %s: http %d", path, resp.StatusCode())
	}
	return &out, nil
}

// Img 拼接完整图片地址。size 如 w500 / original。
func (c *Client) Img(path, size string) string {
	if path == "" {
		return ""
	}
	return fmt.Sprintf("%s/%s%s", c.imageBase, size, path)
}
