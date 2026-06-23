// Package slug 把（中文）片名转成 URL 友好的拼音 slug，如「地球人实在太凶猛了」→ diqiuren-shizai-taixiongmengle。
//
// 名词解释：
//   - slug：URL 里那段“人类可读、对 SEO 友好”的标识，只含小写字母/数字/连字符，
//     例如 /title/diqiuren-... 比 /title/12345 更友好。
//   - 拼音：汉字的拉丁化读音；本包用第三方库逐字转换。
package slug

// import 引入本文件用到的外部包。括号是“分组导入”写法，可一次列多个。
import (
	"regexp"  // 标准库：正则表达式（这里用来把连续的“-”压成一个）
	"strings" // 标准库：字符串工具（TrimSpace 去空白、Trim 去首尾字符、Builder 高效拼接）

	// 第三方库：汉字转拼音。import 路径就是它在 GitHub 上的地址；
	// 代码里用它的“包名” pinyin 来调用（包名不一定等于路径最后一段，这里恰好是 pinyin）。
	"github.com/mozillazg/go-pinyin"
)

// var 声明一个“包级变量”（在函数外，整个包可见，程序启动时初始化一次）。
// dashRuns 是变量名；它的类型由右侧返回值推断为 *regexp.Regexp（指向已编译正则的指针）。
//
// regexp.MustCompile：把字符串编译成可复用的正则对象。
//   - “Must” 前缀是 Go 惯例：编译失败会直接 panic（崩溃），而不是返回 error。
//     因为正则是写死的常量、不可能在运行期才发现写错，所以在包加载时一次性编译、出错即崩，最省事。
//   - 反引号 `...` 是“原始字符串字面量”，里面的反斜杠不转义，写正则最方便。
//   - 正则 `-+` 含义：一个连字符 “-” 后面跟 “+”（表示“前一个字符出现 1 次或多次”），
//     合起来就是“一个或多个连续的 -”，用于后面把 "a---b" 里的 "---" 整体替换成单个 "-"。
var dashRuns = regexp.MustCompile(`-+`)

// Make 生成拼音 slug：汉字逐字转拼音，拉丁字母/数字原样保留，其余作分隔，全小写、合并连字符。
// 无法生成（纯符号等）时返回空串，调用方应回退到数字 id。
//
// 函数签名拆解：
//   - func        ：定义函数的关键字。
//   - Make        ：函数名。首字母大写表示“导出”（exported），包外可调用（如 slug.Make(...)）；
//     若首字母小写则只在本包内可见。
//   - (name string)：参数列表。形参名 name，类型 string。Go 是“类型在后”。
//   - string      ：返回值类型（返回一个字符串）。
func Make(name string) string {
	// strings.TrimSpace(name)：去掉字符串首尾的所有空白字符（空格、制表符、换行等）。
	// name = ...：把结果重新赋值回 name（覆盖原值）。这里用 “=” 而非 “:=”，因为 name 已存在（是形参），只是赋新值。
	name = strings.TrimSpace(name)

	// 边界处理：去空白后若为空串，说明没有可用内容，直接返回空串（符合注释里“无法生成时返回空串”的约定）。
	// "" 是空字符串字面量；== 是相等比较。
	if name == "" {
		return ""
	}

	// pinyin.NewArgs()：创建一份“转换参数”。库默认用 Normal 风格——无声调、纯小写字母（如 “中”→"zhong"）。
	// a := ...：短变量声明。“:=” 会同时“声明并初始化”一个新变量，类型由右侧自动推断（这里是 pinyin.Args）。
	a := pinyin.NewArgs() // 默认 Normal：无声调、小写

	// strings.Builder：高效拼接字符串的“缓冲区”。
	// 为什么不用 s += "x"？因为 Go 的 string 不可变，每次 += 都要重新分配内存、复制一遍，循环里很浪费；
	// Builder 内部维护一块可增长的字节缓冲，多次写入只在需要时扩容，最后一次性产出字符串。
	// var b strings.Builder：声明一个 Builder 类型的变量 b（零值即可用，无需初始化）。
	var b strings.Builder

	// for ... range：遍历。对“字符串”做 range 时，Go 按 UTF-8 解码，每次拿到一个“rune”（Unicode 码点，本质是 int32）。
	//   - 第一个返回值是该字符的“字节下标”，这里用 “_”（空白标识符）丢弃，表示“我不关心它”。
	//   - 第二个返回值 r 就是当前字符（rune）。
	// 关键：range 给的是“一个完整汉字/字符”，而不是单个字节，所以中文不会被拆坏。
	for _, r := range name {
		// switch 不带判断表达式时，等价于 switch true：从上到下找第一个为 true 的 case 执行，匹配后自动结束（不会贯穿到下一个 case）。
		switch {
		// 判断 r 是否落在“CJK 统一汉字”区间 [0x4e00, 0x9fff]（十六进制；常见简繁汉字基本都在此区）。
		// && 是逻辑“与”，两侧都成立才算汉字。
		case r >= 0x4e00 && r <= 0x9fff: // CJK 统一汉字
			// pinyin.SinglePinyin(r, a)：把单个汉字 r 按参数 a 转拼音。
			// 返回值是 []string（字符串切片）——因为多音字可能有多个读音，所以是“一组”候选。
			py := pinyin.SinglePinyin(r, a)
			// len(py)：切片长度。> 0 表示确实拿到了至少一个读音。
			if len(py) > 0 {
				// py[0]：取第一个（默认）读音；下标从 0 开始。
				// b.WriteString(...)：把这段拼音字符串写入缓冲区。
				b.WriteString(py[0])
				// b.WriteByte('-')：写入一个字节 '-' 作为“字与字之间的分隔符”。
				// 注意：'-'（单引号）是“rune/字符字面量”，其 ASCII 值是 45，能放进一个 byte，所以 WriteByte 接受它。
				// （对比："-" 双引号是 string；'-' 单引号是字符。）
				b.WriteByte('-')
			} else {
				// 极少数字符查不到拼音：退化为只写一个分隔符，避免直接丢字导致相邻拼音粘连。
				b.WriteByte('-')
			}
		// 已是 URL 安全字符：小写拉丁字母 a~z 或数字 0~9。
		// 这里比较的是字符的码点大小：'a'..'z' 和 '0'..'9' 在 ASCII 中各自连续，所以用范围判断即可。
		// () 括号把两个范围各自括起，外层用 ||（逻辑“或”，任一成立即可）连接。
		case (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9'):
			// b.WriteRune(r)：原样写入这个字符（rune）。WriteRune 会按 UTF-8 编码写入，能处理任意 rune（虽然这里只会是 ASCII）。
			b.WriteRune(r)
		// 大写拉丁字母 A~Z：保留但要转成小写（slug 约定全小写）。
		case r >= 'A' && r <= 'Z':
			// ASCII 表里同一个字母的“小写码 = 大写码 + 32”（例：'A'=65，'a'=97，差 32）。
			// 所以 r + 32 就把大写转成对应小写，再 WriteRune 写入。
			b.WriteRune(r + 32) // 转小写
		// default：以上都不匹配（空格、标点、其它符号、非 CJK 文字等）。
		default:
			// 一律写成一个分隔符 '-'，相当于“用连字符代替”这些不安全字符。
			b.WriteByte('-')
		}
	}

	// 循环结束后，缓冲里可能出现多个连续的 '-'（比如“汉字 标点 汉字”会产生 "xx--yy"）。
	// b.String()：把缓冲区内容产出为最终字符串。
	// dashRuns.ReplaceAllString(原串, "-")：用前面编译好的正则，把“一段或多段连续的 -”统一替换成单个 "-"。
	// s := ...：声明并接收结果。
	s := dashRuns.ReplaceAllString(b.String(), "-")

	// strings.Trim(s, "-")：去掉字符串“首尾”的 '-'（第二个参数是“要剥掉的字符集合”）。
	// 例如开头/结尾若因首字是标点而多出 "-"，这里清掉，得到干净的 slug。
	// 直接 return 这个最终结果。
	return strings.Trim(s, "-")
}
