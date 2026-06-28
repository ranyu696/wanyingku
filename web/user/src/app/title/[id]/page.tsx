import type { Metadata } from "next";
import { type ReactNode } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { Play } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDetail } from "@/lib/cached";
import { KIND_LABELS } from "@/lib/types";
import { DEF_TITLE, SITE_URL } from "@/lib/site";
import { breadcrumbLd, detailLd, detailMetadata, splitNames } from "@/lib/seo";
import PosterImage from "@/components/PosterImage";
import DetailActions from "@/components/DetailActions";
import EpisodePicker from "@/components/EpisodePicker";
import Related from "@/components/Related";
import Comments from "@/components/Comments";
import { Empty } from "@/components/State";


type Params = { params: Promise<{ id: string }> };

// 让指向本页的 <Link prefetch> 连详情数据(getDetail 的 minutes 级 use cache)一起预取，而非只预取静态壳
export const prefetch = "allow-runtime";

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const data = await getDetail(id);
  const d = data?.detail;
  return d ? detailMetadata(d) : { title: DEF_TITLE };
}

// 演职员头像底色：按名字取色，稳定不闪烁
const AV_COLORS = ["#e8506e", "#7c5cff", "#2bb673", "#f5a623", "#3aa0ff", "#d6517d", "#26a69a", "#8d6e63"];
const colorOf = (s: string) =>
  AV_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];

// 外站搜索入口：以片名(+年份)去各平台搜。图标用 simple-icons 官方品牌 SVG path，内联无外部资源
const SEARCH_SITES: { name: string; color: string; path: string; url: (q: string) => string }[] = [
  {
    name: "豆瓣",
    color: "#2f9642",
    path: "M.51 3.06h22.98V.755H.51V3.06Zm20.976 2.537v9.608h-2.137l-1.669 5.76H24v2.28H0v-2.28h6.32l-1.67-5.76H2.515V5.597h18.972Zm-5.066 9.608H7.58l1.67 5.76h5.501l1.67-5.76ZM18.367 7.9H5.634v5.025h12.733V7.9Z",
    url: (q) => `https://search.douban.com/movie/subject_search?search_text=${q}`,
  },
  {
    name: "抖音",
    color: "#000000",
    path: "M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z",
    url: (q) => `https://www.douyin.com/search/${q}`,
  },
  {
    name: "微博",
    color: "#e6162d",
    path: "M10.098 20.323c-3.977.391-7.414-1.406-7.672-4.02-.259-2.609 2.759-5.047 6.74-5.441 3.979-.394 7.413 1.404 7.671 4.018.259 2.6-2.759 5.049-6.737 5.439l-.002.004zM9.05 17.219c-.384.616-1.208.884-1.829.602-.612-.279-.793-.991-.406-1.593.379-.595 1.176-.861 1.793-.601.622.263.82.972.442 1.592zm1.27-1.627c-.141.237-.449.353-.689.253-.236-.09-.313-.361-.177-.586.138-.227.436-.346.672-.24.239.09.315.36.18.601l.014-.028zm.176-2.719c-1.893-.493-4.033.45-4.857 2.118-.836 1.704-.026 3.591 1.886 4.21 1.983.64 4.318-.341 5.132-2.179.8-1.793-.201-3.642-2.161-4.149zm7.563-1.224c-.346-.105-.57-.18-.405-.615.375-.977.42-1.804 0-2.404-.781-1.112-2.915-1.053-5.364-.03 0 0-.766.331-.571-.271.376-1.217.315-2.224-.27-2.809-1.338-1.337-4.869.045-7.888 3.08C1.309 10.87 0 13.273 0 15.348c0 3.981 5.099 6.395 10.086 6.395 6.536 0 10.888-3.801 10.888-6.82 0-1.822-1.547-2.854-2.915-3.284v.01zm1.908-5.092c-.766-.856-1.908-1.187-2.96-.962-.436.09-.706.511-.616.932.09.42.511.691.932.602.511-.105 1.067.044 1.442.465.376.421.466.977.316 1.473-.136.406.089.856.51.992.405.119.857-.105.992-.512.33-1.021.12-2.178-.646-3.035l.03.045zm2.418-2.195c-1.576-1.757-3.905-2.419-6.054-1.968-.496.104-.812.587-.706 1.081.104.496.586.813 1.082.707 1.532-.331 3.185.15 4.296 1.383 1.112 1.246 1.429 2.943.947 4.416-.165.48.106 1.007.586 1.157.479.165.991-.104 1.157-.586.675-2.088.241-4.478-1.338-6.235l.03.045z",
    url: (q) => `https://s.weibo.com/weibo?q=${q}`,
  },
  {
    name: "快手",
    color: "#ff4906",
    path: "M18.315 12.264c2.33 0 4.218 1.88 4.218 4.2V19.8c0 2.32-1.888 4.2-4.218 4.2h-6.202a4.218 4.218 0 0 1-4.023-2.938l-3.676 1.833a2.04 2.04 0 0 1-2.731-.903 2.015 2.015 0 0 1-.216-.907v-5.94a2.03 2.03 0 0 1 2.035-2.024 2.044 2.044 0 0 1 .919.218l3.673 1.85a4.218 4.218 0 0 1 4.02-2.925zm-.062 2.162h-6.078c-1.153 0-2.09.921-2.108 2.065v3.247c0 1.148.925 2.081 2.073 2.1h6.113c1.153 0 2.09-.922 2.109-2.065v-3.247a2.104 2.104 0 0 0-2.074-2.1zM4.18 15.72a.554.554 0 0 0-.555.542v3.734a.556.556 0 0 0 .798.496l.01-.004 3.463-1.756V17.51l-3.467-1.73a.557.557 0 0 0-.249-.06zM9.28 0a5.667 5.667 0 0 1 4.98 2.965 4.921 4.921 0 0 1 3.36-1.317c2.714 0 4.913 2.177 4.913 4.863 0 2.686-2.2 4.863-4.912 4.863a4.921 4.921 0 0 1-3.996-2.034 5.651 5.651 0 0 1-4.345 2.034c-3.131 0-5.67-2.546-5.67-5.687C3.61 2.546 6.149 0 9.28 0Zm8.34 3.926c-1.441 0-2.61 1.157-2.61 2.585s1.169 2.585 2.61 2.585c1.443 0 2.612-1.157 2.612-2.585s-1.169-2.585-2.611-2.585zM9.28 2.287a3.395 3.395 0 0 0-3.39 3.4c0 1.877 1.518 3.4 3.39 3.4a3.395 3.395 0 0 0 3.39-3.4c0-1.878-1.518-3.4-3.39-3.4z",
    url: (q) => `https://www.kuaishou.com/search/video?searchKey=${q}`,
  },
  {
    name: "百度",
    color: "#2932e1",
    path: "M9.154 0C7.71 0 6.54 1.658 6.54 3.707c0 2.051 1.171 3.71 2.615 3.71 1.446 0 2.614-1.659 2.614-3.71C11.768 1.658 10.6 0 9.154 0zm7.025.594C14.86.58 13.347 2.589 13.2 3.927c-.187 1.745.25 3.487 2.179 3.735 1.933.25 3.175-1.806 3.422-3.364.252-1.555-.995-3.364-2.362-3.674a1.218 1.218 0 0 0-.261-.03zM3.582 5.535a2.811 2.811 0 0 0-.156.008c-2.118.19-2.428 3.24-2.428 3.24-.287 1.41.686 4.425 3.297 3.864 2.617-.561 2.262-3.68 2.183-4.362-.125-1.018-1.292-2.773-2.896-2.75zm16.534 1.753c-2.308 0-2.617 2.119-2.617 3.616 0 1.43.121 3.425 2.988 3.362 2.867-.063 2.553-3.238 2.553-3.988 0-.745-.62-2.99-2.924-2.99zm-8.264 2.478c-1.424.014-2.708.925-3.323 1.947-1.118 1.868-2.863 3.05-3.112 3.363-.25.309-3.61 2.116-2.864 5.42.746 3.301 3.365 3.237 3.365 3.237s1.93.19 4.171-.31c2.24-.495 4.17.123 4.17.123s5.233 1.748 6.665-1.616c1.43-3.364-.808-5.109-.808-5.109s-2.99-2.306-4.736-4.798c-1.072-1.665-2.348-2.268-3.528-2.257zm-2.234 3.84l1.542.024v8.197H7.758c-1.47-.291-2.055-1.292-2.13-1.462-.072-.173-.488-.976-.268-2.343.635-2.049 2.447-2.196 2.447-2.196h1.81zm3.964 2.39v3.881c.096.413.612.488.612.488h1.614v-4.343h1.689v5.782h-3.915c-1.517-.39-1.59-1.465-1.59-1.465v-4.317zm-5.458 1.147c-.66.197-.978.708-1.05.928-.076.22-.247.78-.1 1.269.294 1.095 1.248 1.144 1.248 1.144h1.37v-3.34z",
    url: (q) => `https://www.baidu.com/s?wd=${q}`,
  },
];

// 分区标题（左侧品牌色竖条 + 粗体）
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <Stack direction="row" sx={{ alignItems: "center", gap: 1, mt: 2.5, mb: 1.2 }}>
      <Box sx={{ width: 3, height: 16, borderRadius: 2, bgcolor: "primary.main" }} />
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
        {children}
      </Typography>
    </Stack>
  );
}

// 影视介绍页（RSC）：简介/选季/选集 + JSON-LD，正文服务端渲染。操作/选集/相关/评论为客户端岛。
export default async function DetailPage({ params }: Params) {
  const { id } = await params;
  const data = await getDetail(id);
  const detail = data?.detail;
  if (!detail) {
    notFound(); // 真 404 + noindex，不被收录（PPR 流式下状态码为 200，靠 noindex 防收录）
  }

  const origin = SITE_URL;
  const lines = detail.play_sources ?? [];
  const eps = lines[0]?.episodes ?? [];
  const hasSource = lines.length > 0 && eps.length > 0;

  const meta = [
    KIND_LABELS[detail.kind],
    detail.season && detail.season > 0 ? `第${detail.season}季` : "",
    detail.year || "",
    detail.vote_average ? `★${detail.vote_average.toFixed(1)}` : "",
    detail.douban_rating ? `豆瓣 ${detail.douban_rating.toFixed(1)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  // 演职员：导演 + 主演，按名字去重，最多 16 人
  const cast = [
    ...splitNames(detail.director).map((n) => ({ name: n, role: "导演" })),
    ...splitNames(detail.actors).map((n) => ({ name: n, role: "主演" })),
  ]
    .filter((v, i, arr) => arr.findIndex((x) => x.name === v.name) === i)
    .slice(0, 16);

  const searchQ = encodeURIComponent(`${detail.name}${detail.year || ""}`);

  const lds = [detailLd(detail, origin), breadcrumbLd(detail, origin)];

  return (
    <Box sx={{ pb: 3 }}>
      {lds.map((ld, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, "\\u003c") }}
        />
      ))}

      {/* Hero：模糊 backdrop + 海报卡片 + 信息 */}
      <Box sx={{ position: "relative", overflow: "hidden" }}>
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            backgroundImage: `url(${detail.backdrop || detail.poster || ""})`,
            backgroundSize: "cover",
            backgroundPosition: "center 20%",
            filter: "blur(24px) brightness(0.42)",
            transform: "scale(1.15)",
          }}
        />
        <Box
          aria-hidden
          sx={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, #08080c 2%, rgba(8,8,12,.5) 60%, rgba(8,8,12,.3))",
          }}
        />
        <Box
          sx={{
            position: "relative",
            display: "flex",
            gap: { xs: 1.5, md: 3 },
            p: { xs: 2, md: 3 },
            alignItems: "flex-end",
          }}
        >
          {/* 海报（点击 → 播放页） */}
          <Box
            sx={{
              width: { xs: 116, sm: 150, md: 200 },
              flexShrink: 0,
              position: "relative",
              borderRadius: 2,
              overflow: "hidden",
              boxShadow: "0 10px 36px rgba(0,0,0,.55)",
              "&:hover .play-ov": { opacity: 1 },
            }}
          >
            {hasSource ? (
              <Link href={`/watch/${id}`} style={{ display: "block" }}>
                <PosterImage
                  src={detail.poster || detail.backdrop}
                  hash={detail.poster_blurhash || detail.backdrop_blurhash}
                  ratio="2 / 3"
                  alt={detail.name}
                  adult={detail.adult}
                />
                <Box
                  className="play-ov"
                  sx={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "rgba(0,0,0,.3)",
                    opacity: { xs: 1, md: 0 },
                    pointerEvents: "none",
                    transition: "opacity .25s",
                  }}
                >
                  <Box
                    sx={{
                      width: 54,
                      height: 54,
                      borderRadius: "50%",
                      bgcolor: "rgba(0,0,0,.55)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Play size={26} fill="#fff" color="#fff" />
                  </Box>
                </Box>
              </Link>
            ) : (
              <PosterImage
                src={detail.poster || detail.backdrop}
                hash={detail.poster_blurhash || detail.backdrop_blurhash}
                ratio="2 / 3"
                alt={detail.name}
                adult={detail.adult}
              />
            )}
          </Box>

          {/* 信息 */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography component="h1" variant="h5" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
              {detail.name}
            </Typography>
            {detail.original_name && detail.original_name !== detail.name ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {detail.original_name}
              </Typography>
            ) : null}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              {meta}
            </Typography>

            {detail.genres && detail.genres.length > 0 ? (
              <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 1, display: { xs: "none", sm: "flex" } }}>
                {detail.genres.map((g) => (
                  <Chip key={g.id} size="small" label={g.name} />
                ))}
              </Stack>
            ) : null}

            <DetailActions
              idParam={id}
              tid={detail.id}
              kind={detail.kind}
              hasSource={hasSource}
              initialLikeCount={detail.like_count || 0}
            />
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: { xs: 1.5, md: 2 } }}>
        {/* 题材（窄屏补显） */}
        {detail.genres && detail.genres.length > 0 ? (
          <Stack direction="row" sx={{ flexWrap: "wrap", gap: 0.5, mt: 1.5, display: { xs: "flex", sm: "none" } }}>
            {detail.genres.map((g) => (
              <Chip key={g.id} size="small" label={g.name} />
            ))}
          </Stack>
        ) : null}

        {/* 简介 */}
        {detail.overview || detail.area ? (
          <>
            <SectionTitle>简介</SectionTitle>
            {detail.area ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                地区：{detail.area}
              </Typography>
            ) : null}
            {detail.overview ? (
              <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-line" }}>
                {detail.overview}
              </Typography>
            ) : null}
          </>
        ) : null}

        {/* 去外站搜索（口碑/讨论） */}
        <Stack direction="row" sx={{ alignItems: "center", flexWrap: "wrap", gap: 1, mt: 2 }}>
          {SEARCH_SITES.map((s) => (
            <Box
              key={s.name}
              component="a"
              href={s.url(searchQ)}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`在${s.name}搜索 ${detail.name}`}
              title={`在${s.name}搜索`}
              sx={{
                width: 34,
                height: 34,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(255,255,255,.06)",
                color: s.color,
                transition: "transform .15s, background-color .15s",
                "&:hover": { transform: "scale(1.12)", bgcolor: "rgba(255,255,255,.12)" },
              }}
            >
              <Box component="svg" viewBox="0 0 24 24" sx={{ width: 18, height: 18, fill: "currentColor" }}>
                <path d={s.path} />
              </Box>
            </Box>
          ))}
        </Stack>

        {/* 演职员 */}
        {cast.length > 0 ? (
          <>
            <SectionTitle>演职员</SectionTitle>
            <Box sx={{ display: "flex", gap: 1.5, overflowX: "auto", pb: 1, "&::-webkit-scrollbar": { display: "none" } }}>
              {cast.map((c) => (
                <Link
                  key={c.name}
                  href={`/person/${encodeURIComponent(c.name)}`}
                  style={{ textDecoration: "none", color: "inherit" }}
                >
                  <Box sx={{ flex: "0 0 auto", width: 60, textAlign: "center", cursor: "pointer" }}>
                    <Box
                      sx={{
                        width: 52,
                        height: 52,
                        borderRadius: "50%",
                        mx: "auto",
                        bgcolor: colorOf(c.name),
                        color: "#fff",
                        fontWeight: 700,
                        fontSize: "1.25rem",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        transition: "transform .15s",
                        "&:hover": { transform: "scale(1.08)" },
                      }}
                    >
                      {c.name.slice(0, 1)}
                    </Box>
                    <Typography variant="caption" noWrap sx={{ display: "block", mt: 0.5 }}>
                      {c.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontSize: 10, display: "block", lineHeight: 1.2 }}
                    >
                      {c.role}
                    </Typography>
                  </Box>
                </Link>
              ))}
            </Box>
          </>
        ) : null}
      </Box>

      <Box sx={{ px: { xs: 1.5, md: 2 } }}>
        {detail.seasons && detail.seasons.length > 1 ? (
          <Box>
            <SectionTitle>选季 · 共 {detail.seasons.length} 季</SectionTitle>
            <Stack
              direction="row"
              spacing={1.2}
              sx={{ overflowX: "auto", pb: 1, "&::-webkit-scrollbar": { display: "none" } }}
            >
              {detail.seasons.map((s) => {
                const active = s.id === detail.id;
                const inner = (
                  <>
                    <Box
                      sx={{
                        borderRadius: 1.5,
                        overflow: "hidden",
                        border: 2,
                        borderColor: active ? "primary.main" : "transparent",
                      }}
                    >
                      <PosterImage src={s.poster} hash={s.poster_blurhash} alt={s.name} adult={s.adult} />
                    </Box>
                    <Typography
                      variant="caption"
                      noWrap
                      sx={{
                        display: "block",
                        mt: 0.5,
                        fontWeight: active ? 700 : 500,
                        color: active ? "primary.main" : "text.primary",
                      }}
                    >
                      {s.season && s.season > 0 ? `第${s.season}季` : "第1季"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                      {s.year || ""}
                    </Typography>
                  </>
                );
                return active ? (
                  <Box key={s.id} sx={{ flex: "0 0 auto", width: 84 }}>
                    {inner}
                  </Box>
                ) : (
                  <Link
                    key={s.id}
                    href={`/title/${s.slug || s.id}`}
                    style={{ textDecoration: "none", color: "inherit", flex: "0 0 auto", width: 84 }}
                  >
                    {inner}
                  </Link>
                );
              })}
            </Stack>
          </Box>
        ) : null}

        {hasSource ? (
          <>
            <SectionTitle>选集 · 共 {eps.length} 集</SectionTitle>
            <EpisodePicker idParam={id} eps={eps} />
          </>
        ) : (
          <Empty text="暂无播放源" />
        )}

        {detail.id > 0 ? (
          <Box>
            <SectionTitle>相关推荐</SectionTitle>
            <Related tid={detail.id} />
          </Box>
        ) : null}

        <Comments titleId={detail.id} />
      </Box>
    </Box>
  );
}
