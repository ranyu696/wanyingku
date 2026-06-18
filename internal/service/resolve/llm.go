package resolve

import (
	"context"
	"fmt"
	"strings"

	"github.com/xiaoxin/cms/internal/model"
)

const llmSystemPrompt = `你是影视去重助手。给你两条影视条目，判断它们是否指向同一部作品` +
	`（同一部电影 / 同一部剧集），要忽略语种、清晰度、版本、译名写法的差异。` +
	`只输出一个词：same 或 different。`

// llmSame 让大模型仲裁灰区候选是否同一部作品。
func (e *Engine) llmSame(ctx context.Context, in Input, t *model.Title) bool {
	user := fmt.Sprintf(
		"条目A：名称《%s》 年份%d 简介：%s\n条目B：名称《%s》 年份%d 简介：%s\n是否同一部作品？",
		in.Name, in.Year, truncate(in.Overview, 200),
		t.Name, t.Year, truncate(t.Overview, 200),
	)
	ans, err := e.ai.Chat(ctx, llmSystemPrompt, user)
	if err != nil {
		return false
	}
	ans = strings.ToLower(ans)
	return strings.Contains(ans, "same") || strings.Contains(ans, "是") || strings.Contains(ans, "yes")
}
