package collect

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"gorm.io/gorm"
)

// SubmitIndexNow 向 IndexNow(Bing/Yandex 等)提交最近 days 天更新的作品页(slug URL)。
// 上限 10000(IndexNow 单请求上限)；存量收录靠 sitemap。返回提交数与 IndexNow HTTP 状态码。
func SubmitIndexNow(ctx context.Context, db *gorm.DB, site, key string, days int) (int, int, error) {
	site = strings.TrimRight(site, "/")
	var rows []struct {
		ID   int64
		Slug string
	}
	db.WithContext(ctx).Raw(
		`SELECT id, slug FROM titles
		 WHERE status = 1 AND updated_at >= now() - make_interval(days => ?)
		 ORDER BY id LIMIT 10000`, days).Scan(&rows)

	urls := make([]string, 0, len(rows))
	for _, r := range rows {
		slug := r.Slug
		if slug == "" {
			slug = strconv.FormatInt(r.ID, 10)
		}
		urls = append(urls, site+"/title/"+slug)
	}
	if len(urls) == 0 {
		return 0, 0, nil
	}

	host := strings.TrimPrefix(strings.TrimPrefix(site, "https://"), "http://")
	payload, _ := json.Marshal(map[string]any{
		"host":        host,
		"key":         key,
		"keyLocation": site + "/" + key + ".txt",
		"urlList":     urls,
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		"https://api.indexnow.org/IndexNow", bytes.NewReader(payload))
	if err != nil {
		return 0, 0, err
	}
	req.Header.Set("Content-Type", "application/json; charset=utf-8")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, 0, err
	}
	defer resp.Body.Close()
	return len(urls), resp.StatusCode, nil
}
