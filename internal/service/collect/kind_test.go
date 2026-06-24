package collect

import (
	"strconv"
	"strings"
	"testing"

	"github.com/xiaoxin/cms/internal/model"
)

func TestClassifyKind(t *testing.T) {
	cases := []struct {
		leaf, root string
		want       int16
	}{
		{"短剧", "", model.KindShort},
		{"现代都市", "短剧大全", model.KindShort}, // 叶子是泛题材，顶级兜底到短剧
		{"电影", "", model.KindMovie},
		{"连续剧", "", model.KindTV},
		{"动漫", "", model.KindAnime},
		{"都市", "", model.KindMovie}, // 谁也没命中 → 默认电影
	}
	for _, c := range cases {
		if got := ClassifyKind(c.leaf, c.root); got != c.want {
			t.Errorf("ClassifyKind(%q,%q)=%d want %d", c.leaf, c.root, got, c.want)
		}
	}
}

func TestFixShortByEpisodes(t *testing.T) {
	cases := []struct {
		kind     int16
		episodes int
		want     int16
	}{
		{model.KindMovie, 80, model.KindShort},                 // 电影但 80 集 → 短剧
		{model.KindMovie, shortDramaEpMin, model.KindShort},    // 恰好达阈值
		{model.KindMovie, shortDramaEpMin - 1, model.KindMovie}, // 差一集，不动
		{model.KindMovie, 1, model.KindMovie},                  // 正常电影
		{model.KindTV, 80, model.KindTV},                       // 非电影不纠偏
	}
	for _, c := range cases {
		if got := FixShortByEpisodes(c.kind, c.episodes); got != c.want {
			t.Errorf("FixShortByEpisodes(%d,%d)=%d want %d", c.kind, c.episodes, got, c.want)
		}
	}
}

func TestMaxEpisodes(t *testing.T) {
	// 构造一条 25 集的 maccms 播放列表
	var eps []string
	for i := 1; i <= 25; i++ {
		eps = append(eps, "第"+strconv.Itoa(i)+"集$http://a.com/"+strconv.Itoa(i)+".m3u8")
	}
	groups := ParsePlay("线路1", strings.Join(eps, "#"))
	if got := MaxEpisodes(groups); got != 25 {
		t.Errorf("MaxEpisodes=%d want 25", got)
	}
}
