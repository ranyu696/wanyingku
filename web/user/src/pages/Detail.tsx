import { type ReactNode, useEffect, useState } from "react";
import { Box, Button, Chip, Stack, Typography } from "@mui/material";
import { Bell, BellRing, Heart, Play, ThumbsUp } from "lucide-react";
import { getRouteApi, useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { useFavoriteOps, useLikeTitle, useRelated, useSubscribeOps } from "../api/hooks";
import Comments from "../components/Comments";
import { useSeo } from "../seo";
import PosterCard from "../components/PosterCard";
import PosterImage from "../components/PosterImage";
import { Empty } from "../components/State";
import { KIND_LABELS } from "../api/types";
import { useAuth } from "../store/auth";

const detailApi = getRouteApi("/title/$id");

// 演职员头像底色：按名字取色，稳定不闪烁
const AV_COLORS = ["#e8506e", "#7c5cff", "#2bb673", "#f5a623", "#3aa0ff", "#d6517d", "#26a69a", "#8d6e63"];
const colorOf = (s: string) =>
  AV_COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % AV_COLORS.length];
const splitNames = (s?: string) =>
  s ? s.split(/[,，、/]/).map((x) => x.trim()).filter(Boolean) : [];

// 分区标题（左侧品牌色竖条 + 粗体），用来拉开内容层级
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

// 影视介绍页：只有简介/选季/选集，没有播放器。点「播放」或某一集才跳到独立播放页 /watch。
export default function Detail() {
  const { id } = useParams({ from: "/title/$id" }); // 拼音 slug 或数字 id
  const data = detailApi.useLoaderData(); // SSR loader 取数（首屏带正文）
  const router = useRouter();
  const tid = data?.detail?.id ?? 0;
  const nav = useNavigate();
  const { token } = useAuth();
  const fav = useFavoriteOps();
  const sub = useSubscribeOps();
  const likeOp = useLikeTitle();
  const related = useRelated(tid);
  const [isFav, setIsFav] = useState(false);
  const [isSub, setIsSub] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [epPage, setEpPage] = useState(0); // 选集分段（集数多时按 1-40 / 41-80… 翻段）

  useEffect(() => {
    if (!data) {
      return;
    }
    setIsFav(Boolean(data.is_favorite));
    setIsSub(Boolean(data.is_subscribed));
    setIsLiked(Boolean(data.is_liked));
    setLikeCount(data.detail.like_count || 0);
  }, [data]);

  // 详情含用户态(收藏/点赞/订阅)，SSR/匿名 loader 取不到 → 登录态下客户端再校验一次
  useEffect(() => {
    if (token) {
      void router.invalidate();
    }
  }, [token, router]);

  const detail = data?.detail;
  useSeo(
    detail ? `${detail.name}${detail.year ? ` (${detail.year})` : ""} 在线观看` : undefined,
    detail?.overview,
  );
  if (!detail) {
    return <Empty text="影片不存在" />;
  }

  const lines = detail.play_sources ?? [];
  const eps = lines[0]?.episodes ?? [];
  const hasSource = lines.length > 0 && eps.length > 0;
  const resumeIdx = data?.progress?.episode_idx ?? 0;
  // 选集分段：集数多时按 40 一段
  const EP_PAGE = 40;
  const epPages = Math.max(1, Math.ceil(eps.length / EP_PAGE));
  const curEpPage = Math.min(epPage, epPages - 1);
  const epStart = curEpPage * EP_PAGE;
  const epSlice = eps.slice(epStart, epStart + EP_PAGE);

  const requireLogin = () => void nav({ to: "/login" });
  const toggleFav = async () => {
    if (!token) {
      requireLogin();
      return;
    }
    try {
      if (isFav) {
        await fav.remove.send(tid);
      } else {
        await fav.add.send(tid);
      }
      setIsFav(!isFav);
    } catch {
      /* ignore */
    }
  };
  const toggleSub = async () => {
    if (!token) {
      requireLogin();
      return;
    }
    try {
      if (isSub) {
        await sub.remove.send(tid);
      } else {
        await sub.add.send(tid);
      }
      setIsSub(!isSub);
    } catch {
      /* ignore */
    }
  };
  const toggleLike = async () => {
    if (!token) {
      requireLogin();
      return;
    }
    try {
      await likeOp.send({ titleId: tid, on: !isLiked });
      setLikeCount((n) => n + (isLiked ? -1 : 1));
      setIsLiked(!isLiked);
    } catch {
      /* ignore */
    }
  };
  // 跳独立播放页（不传 ep 则续播/首集）
  const goWatch = (epIndex?: number) =>
    void nav({ to: "/watch/$id", params: { id }, search: epIndex != null ? { ep: epIndex } : {} });

  const meta = [
    KIND_LABELS[detail.kind],
    detail.season && detail.season > 0 ? `第${detail.season}季` : "",
    detail.year || "",
    detail.vote_average ? `★${detail.vote_average.toFixed(1)}` : "",
    detail.douban_rating ? `豆瓣 ${detail.douban_rating.toFixed(1)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");

  // 导演/主演：拆成可点击的人名 → 演员/导演聚合页
  // 演职员：导演 + 主演，按名字去重，最多 16 人
  const cast = [
    ...splitNames(detail.director).map((n) => ({ name: n, role: "导演" })),
    ...splitNames(detail.actors).map((n) => ({ name: n, role: "主演" })),
  ]
    .filter((v, i, arr) => arr.findIndex((x) => x.name === v.name) === i)
    .slice(0, 16);

  return (
    <Box sx={{ pb: 3 }}>
      {/* Hero：模糊 backdrop + 海报卡片 + 信息（参考 vphim） */}
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
            onClick={() => hasSource && goWatch()}
            sx={{
              width: { xs: 116, sm: 150, md: 200 },
              flexShrink: 0,
              position: "relative",
              borderRadius: 2,
              overflow: "hidden",
              boxShadow: "0 10px 36px rgba(0,0,0,.55)",
              cursor: hasSource ? "pointer" : "default",
              "&:hover .play-ov": { opacity: 1 },
            }}
          >
            <PosterImage
              src={detail.poster || detail.backdrop}
              hash={detail.poster_blurhash || detail.backdrop_blurhash}
              ratio="2 / 3"
              alt={detail.name}
              adult={detail.adult}
            />
            {hasSource ? (
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
                  pointerEvents: "none", // 纯装饰，不挡成人遮罩点击
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
            ) : null}
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

            <Stack direction="row" sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
              {hasSource ? (
                <Button
                  size="small"
                  variant="contained"
                  color="primary"
                  startIcon={<Play size={18} fill="currentColor" />}
                  onClick={() => goWatch()}
                >
                  {data?.progress && resumeIdx > 0 ? `继续观看 第${resumeIdx}集` : "播放"}
                </Button>
              ) : null}
              <Button
                size="small"
                variant={isFav ? "contained" : "outlined"}
                color="primary"
                startIcon={<Heart size={18} fill={isFav ? "currentColor" : "none"} />}
                onClick={toggleFav}
              >
                {isFav ? "已收藏" : "收藏"}
              </Button>
              <Button
                size="small"
                variant={isLiked ? "contained" : "outlined"}
                color="secondary"
                startIcon={<ThumbsUp size={18} fill={isLiked ? "currentColor" : "none"} />}
                onClick={toggleLike}
              >
                {likeCount > 0 ? likeCount : "点赞"}
              </Button>
              {detail.kind !== 1 ? (
                <Button
                  size="small"
                  variant={isSub ? "contained" : "outlined"}
                  color="success"
                  startIcon={isSub ? <BellRing size={18} /> : <Bell size={18} />}
                  onClick={toggleSub}
                >
                  {isSub ? "已订阅" : "订阅更新"}
                </Button>
              ) : null}
            </Stack>
          </Box>
        </Box>
      </Box>

      <Box sx={{ px: { xs: 1.5, md: 2 } }}>
        {/* 题材（窄屏补显，hero 上未显示） */}
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
            <Box
              sx={{
                display: "flex",
                gap: 1.5,
                overflowX: "auto",
                pb: 1,
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              {cast.map((c) => (
              <Box
                key={c.name}
                onClick={() => void nav({ to: "/person/$name", params: { name: c.name } })}
                sx={{ flex: "0 0 auto", width: 60, textAlign: "center", cursor: "pointer" }}
              >
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
                const active = s.id === tid;
                return (
                  <Box
                    key={s.id}
                    onClick={() => {
                      if (!active) {
                        void nav({ to: "/title/$id", params: { id: s.slug || String(s.id) } });
                      }
                    }}
                    sx={{ flex: "0 0 auto", width: 84, cursor: "pointer" }}
                  >
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
                  </Box>
                );
              })}
            </Stack>
          </Box>
        ) : null}

        {hasSource ? (
          <>
            <SectionTitle>选集 · 共 {eps.length} 集</SectionTitle>
            {/* 集数多时分段：1-40 / 41-80 … */}
            {epPages > 1 ? (
              <Stack
                direction="row"
                spacing={0.8}
                sx={{ mb: 1.2, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" } }}
              >
                {Array.from({ length: epPages }).map((_, p) => {
                  const a = p * EP_PAGE + 1;
                  const b = Math.min((p + 1) * EP_PAGE, eps.length);
                  return (
                    <Chip
                      key={p}
                      size="small"
                      label={`${a}-${b}`}
                      color={p === curEpPage ? "primary" : "default"}
                      variant={p === curEpPage ? "filled" : "outlined"}
                      onClick={() => setEpPage(p)}
                      sx={{ flexShrink: 0 }}
                    />
                  );
                })}
              </Stack>
            ) : null}
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: {
                  xs: "1fr 1fr",
                  sm: "repeat(3, 1fr)",
                  md: "repeat(4, 1fr)",
                },
                gap: 1,
              }}
            >
              {epSlice.map((e, j) => {
                const i = epStart + j;
                return (
                  <Box
                    key={e.id}
                    onClick={() => goWatch(i)}
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 0.8,
                      px: 1,
                      py: 0.9,
                      borderRadius: 1.5,
                      border: "1px solid",
                      borderColor: "divider",
                      cursor: "pointer",
                      transition: "border-color .15s, background .15s",
                      "&:hover": { borderColor: "primary.main", bgcolor: "rgba(255,255,255,.03)" },
                    }}
                  >
                    <Typography variant="caption" color="text.secondary" sx={{ minWidth: 20, textAlign: "right" }}>
                      {i + 1}
                    </Typography>
                    <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                      {e.name}
                    </Typography>
                  </Box>
                );
              })}
            </Box>
          </>
        ) : (
          <Empty text="暂无播放源" />
        )}

        {related.data && related.data.length > 0 ? (
          <Box>
            <SectionTitle>相关推荐</SectionTitle>
            <Box
              sx={{
                display: "flex",
                gap: 1.2,
                overflowX: "auto",
                pb: 1,
                scrollSnapType: "x mandatory",
                "&::-webkit-scrollbar": { display: "none" },
              }}
            >
              {related.data.map((t) => (
                <Box
                  key={t.id}
                  sx={{ flex: "0 0 auto", width: { xs: 112, sm: 130, md: 150 }, scrollSnapAlign: "start" }}
                >
                  <PosterCard t={t} />
                </Box>
              ))}
            </Box>
          </Box>
        ) : null}

        <Comments titleId={tid} />
      </Box>
    </Box>
  );
}
