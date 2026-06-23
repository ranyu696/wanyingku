import type { Metadata } from "next";
import { type ReactNode } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import { Play } from "lucide-react";
import Link from "next/link";
import { serverGetSafe } from "@/lib/api";
import type { DetailResp } from "@/lib/types";
import { KIND_LABELS } from "@/lib/types";
import { DEF_TITLE, SITE_URL } from "@/lib/site";
import { breadcrumbLd, detailLd, detailMetadata, splitNames } from "@/lib/seo";
import PosterImage from "@/components/PosterImage";
import DetailActions from "@/components/DetailActions";
import EpisodePicker from "@/components/EpisodePicker";
import Related from "@/components/Related";
import Comments from "@/components/Comments";
import { Empty } from "@/components/State";

export const revalidate = 60;

type Params = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { id } = await params;
  const data = await serverGetSafe<DetailResp>(`/titles/${id}`);
  const d = data?.detail;
  return d ? detailMetadata(d) : { title: DEF_TITLE };
}

// 演职员头像底色：按名字取色，稳定不闪烁
const AV_COLORS = ["#e8506e", "#7c5cff", "#2bb673", "#f5a623", "#3aa0ff", "#d6517d", "#26a69a", "#8d6e63"];
const colorOf = (s: string) =>
  AV_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];

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
  const data = await serverGetSafe<DetailResp>(`/titles/${id}`);
  const detail = data?.detail;
  if (!detail) {
    return <Empty text="影片不存在" />;
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
