package collect

import "testing"

// ParsePlay 只采直链 m3u8：云播分享页(/share/..)、解析线、mp4 应被整组丢弃。
func TestParsePlayKeepsOnlyM3U8(t *testing.T) {
	// 真实 maccms 形态：u酷资源 同时给 ukm3u8(直链) 和 ukyun(云播分享页) 两条 flag
	playFrom := "ukm3u8$$$ukyun"
	playURL := "第01集$https://ukzy.ukubf4.com/a/index.m3u8#第02集$https://ukzy.ukubf4.com/b/index.m3u8?auth=x" +
		"$$$第01集$https://ukzy.ukubf4.com/share/uDIxn4LTfaLFmHyo"

	groups := ParsePlay(playFrom, playURL)
	if len(groups) != 1 {
		t.Fatalf("应只保留 1 条 m3u8 线路，得到 %d 条: %+v", len(groups), groups)
	}
	if groups[0].Flag != "ukm3u8" || len(groups[0].Episodes) != 2 {
		t.Fatalf("保留的线路不对: flag=%q eps=%d", groups[0].Flag, len(groups[0].Episodes))
	}

	// mp4 直链也按「只采 m3u8」丢弃
	if g := ParsePlay("dplayer", "第01集$https://x.com/v.mp4"); len(g) != 0 {
		t.Fatalf("mp4 应被丢弃，得到 %+v", g)
	}
}
