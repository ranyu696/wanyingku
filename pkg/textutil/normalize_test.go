package textutil

import "testing"

// 第一层（精确归一化）：纯装饰差异（语种/版本/年份/季标记）应归一化为同一字符串。
func TestNormalizeMergesDecorationVariants(t *testing.T) {
	groups := [][]string{
		{
			"复仇者联盟4",
			"复仇者联盟4（国语版）",
			"复仇者联盟4 2019 HD",
			"复仇者联盟4【蓝光1080P】",
		},
		{
			"庆余年第二季",
			"庆余年 第2季 1080P",
			"庆余年（第二季）国语",
		},
		{
			"鱿鱼游戏",
			"鱿鱼游戏 中字",
			"鱿鱼游戏 4K 未删减",
		},
		{
			"石纪元第四季",
			"石纪元 第四季 Part 3",
			"石纪元 第4季 Cour 2",
			"石纪元 第二部分",
		},
	}
	for _, g := range groups {
		want := Normalize(g[0])
		if want == "" {
			t.Fatalf("归一化结果为空: %q", g[0])
		}
		for _, v := range g[1:] {
			if got := Normalize(v); got != want {
				t.Errorf("应合并但不一致:\n  %q -> %q\n  %q -> %q", g[0], want, v, got)
			}
		}
	}
}

// 第三层（模糊召回）：带副标题/简称的写法虽不字节相等，但相似度应达到自动合并阈值(0.86)。
func TestFuzzyMergesSubtitleVariants(t *testing.T) {
	const autoMerge = 0.86
	pairs := [][2]string{
		{"复仇者联盟4：终局之战", "复仇者联盟4"},
		{"庆余年 第二季", "庆余年"},
	}
	for _, p := range pairs {
		s := Similarity(Normalize(p[0]), Normalize(p[1]))
		if s < autoMerge {
			t.Errorf("应被模糊层合并但相似度不足: %q vs %q = %.2f", p[0], p[1], s)
		}
	}
}

func TestNormalizeKeepsDistinct(t *testing.T) {
	if Normalize("误杀") == Normalize("误杀2") {
		t.Error("不同影片不应归一化为同一标题")
	}
}

func TestSimilarity(t *testing.T) {
	// 包含关系应给高分（便于 TMDB 候选排序）
	if s := Similarity("复仇者联盟4", "复仇者联盟4终局之战"); s < 0.7 {
		t.Errorf("包含关系相似度过低: %.2f", s)
	}
	// 完全不同应低分
	if s := Similarity("误杀", "盗梦空间"); s > 0.3 {
		t.Errorf("无关标题相似度过高: %.2f", s)
	}
}

func TestDetectLangAndYearAndEp(t *testing.T) {
	if DetectLang("复仇者联盟4 国语") != "国语" {
		t.Error("应识别国语")
	}
	if DetectLang("某剧 粤语版") != "粤语" {
		t.Error("应识别粤语")
	}
	if ExtractYear("流浪地球 2019 HD") != 2019 {
		t.Error("应提取年份 2019")
	}
	if ParseEpisodeNo("第08集") != 8 {
		t.Error("应解析出第8集")
	}
	if ParseEpisodeNo("EP12") != 12 {
		t.Error("应解析出 EP12")
	}
}
