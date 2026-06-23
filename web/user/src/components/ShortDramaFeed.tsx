"use client";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  Drawer,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import {
  Bookmark,
  ChevronLeft,
  CirclePlay,
  Heart,
  ListVideo,
  MessageCircle,
  Send,
  Share2,
  VolumeX,
} from "lucide-react";
import Hls from "hls.js";
import { useRouter } from "next/navigation";
import {
  useComments,
  useCommentOps,
  useFavoriteOps,
  useLikeTitle,
  useSaveProgress,
} from "@/lib/hooks";
import type { DetailResp } from "@/lib/types";
import { epBtnSx, epGridSx } from "@/lib/format";
import { useAuth } from "@/store/auth";

interface PlayState {
  cur: number;
  dur: number;
  paused: boolean;
  buffering: boolean;
}

// 单个竖屏视频：原生 <video> + hls.js，仅在 active 时挂载播放，离开即释放。
function FeedVideo({
  url,
  active,
  startAt,
  onReady,
  onTime,
  onState,
  onEnded,
  onMuted,
}: {
  url: string;
  active: boolean;
  startAt: number;
  onReady: (el: HTMLVideoElement) => void;
  onTime: (cur: number, dur: number) => void;
  onState: (s: Partial<PlayState>) => void;
  onEnded: () => void;
  onMuted: (muted: boolean) => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v || !active) {
      return;
    }
    onReady(v);
    let hls: Hls | null = null;
    const isHls = /\.m3u8(\?|$)/i.test(url);
    if (isHls && !v.canPlayType("application/vnd.apple.mpegurl") && Hls.isSupported()) {
      hls = new Hls({ maxBufferLength: 20 });
      hls.loadSource(url);
      hls.attachMedia(v);
    } else {
      v.src = url;
    }

    const onLoaded = () => {
      if (startAt > 1) {
        v.currentTime = startAt;
      }
      v.play().catch(() => {
        // 自动播放被拦截：静音重试，给出取消静音提示
        v.muted = true;
        onMuted(true);
        v.play().catch(() => undefined);
      });
    };
    const onTimeUpdate = () => onTime(v.currentTime, v.duration || 0);
    const onPlaying = () => onState({ paused: false, buffering: false });
    const onPlay = () => onState({ paused: false });
    const onPause = () => onState({ paused: true });
    const onWaiting = () => onState({ buffering: true });
    const onEnd = () => onEnded();

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("timeupdate", onTimeUpdate);
    v.addEventListener("playing", onPlaying);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("ended", onEnd);

    return () => {
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("timeupdate", onTimeUpdate);
      v.removeEventListener("playing", onPlaying);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("ended", onEnd);
      v.pause();
      if (hls) {
        hls.destroy();
      } else {
        v.removeAttribute("src");
        v.load();
      }
    };
  }, [url, active]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <video
      ref={ref}
      playsInline
      autoPlay
      style={{ width: "100%", height: "100%", objectFit: "contain", background: "#000" }}
    />
  );
}

// 右侧动作按钮（赞/藏/评/集/享）
function RailAction({
  icon,
  label,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Stack
      spacing={0.3}
      onClick={onClick}
      sx={{ alignItems: "center", cursor: "pointer", pointerEvents: "auto", userSelect: "none" }}
    >
      <Box
        sx={{
          width: 46,
          height: 46,
          borderRadius: "50%",
          display: "grid",
          placeItems: "center",
          color: active ? "#ff4d5e" : "#fff",
          bgcolor: "rgba(0,0,0,.35)",
          backdropFilter: "blur(6px)",
          border: "1px solid rgba(255,255,255,.18)",
          transition: "transform .12s",
          "&:active": { transform: "scale(.88)" },
        }}
      >
        {icon}
      </Box>
      <Typography variant="caption" sx={{ color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,.8)" }}>
        {label}
      </Typography>
    </Stack>
  );
}

// 短剧 9:16 全屏信息流：上下滑切集 + 右侧动作栏 + 极简手势控件。
export default function ShortDramaFeed({ resp, reload }: { resp: DetailResp; reload: () => void }) {
  const router = useRouter();
  const { token } = useAuth();
  const detail = resp.detail;
  const tid = detail.id;
  const lines = detail.play_sources ?? [];

  const save = useSaveProgress();
  const likeReq = useLikeTitle();
  const favOps = useFavoriteOps();

  // 起播线路：进度 > 记忆 flag > 首条
  const initLine = useMemo(() => {
    if (resp.progress) {
      const li = lines.findIndex((ps) => ps.id === resp.progress?.play_source_id);
      if (li >= 0) {
        return li;
      }
    }
    const f = typeof localStorage === "undefined" ? null : localStorage.getItem(`yinshi_line_${tid}`);
    if (f) {
      const li = lines.findIndex((ps) => ps.flag === f);
      if (li >= 0) {
        return li;
      }
    }
    return 0;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [lineIdx, setLineIdx] = useState(initLine);
  const line = lines[lineIdx];
  const eps = line?.episodes ?? [];

  // 起播集 + 续播位置（仅首集生效）
  const initEp = useMemo(() => {
    if (resp.progress && lines[initLine]) {
      const ei = lines[initLine].episodes.findIndex((e) => e.idx === resp.progress?.episode_idx);
      if (ei >= 0) {
        return ei;
      }
    }
    return 0;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const resumeIdxRef = useRef(initEp);
  const resumePos = resp.progress?.position ?? 0;

  const [activeIdx, setActiveIdx] = useState(initEp);
  const [pb, setPb] = useState<PlayState>({ cur: 0, dur: 0, paused: false, buffering: true });
  const [muted, setMuted] = useState(false);

  const [liked, setLiked] = useState(Boolean(resp.is_liked));
  const [likeCount, setLikeCount] = useState(detail.like_count ?? 0);
  const [favored, setFavored] = useState(Boolean(resp.is_favorite));
  const [heart, setHeart] = useState(0); // 双击爱心动画 key
  const [tip, setTip] = useState("");
  const [sheet, setSheet] = useState<"none" | "episodes" | "comments">("none");

  const scrollRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activeElRef = useRef<HTMLVideoElement | null>(null);
  const lastSave = useRef(0);
  const tapTimer = useRef<number | null>(null);
  const draggingRef = useRef(false);
  const trackRef = useRef<HTMLDivElement>(null);

  // 锁背景滚动
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // 首屏定位到续播集
  useEffect(() => {
    const c = scrollRef.current;
    if (c && initEp > 0) {
      c.scrollTop = c.clientHeight * initEp;
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 切集时复位播放态
  useEffect(() => {
    setPb({ cur: 0, dur: 0, paused: false, buffering: true });
  }, [activeIdx, lineIdx]);

  // 滚动到哪一集就激活哪一集
  useEffect(() => {
    const c = scrollRef.current;
    if (!c) {
      return;
    }
    const io = new IntersectionObserver(
      (ents) => {
        ents.forEach((e) => {
          if (e.isIntersecting && e.intersectionRatio >= 0.6) {
            const idx = Number((e.target as HTMLElement).dataset.idx);
            if (!Number.isNaN(idx)) {
              setActiveIdx(idx);
            }
          }
        });
      },
      { root: c, threshold: [0.6] },
    );
    sectionRefs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [lineIdx, eps.length]);

  // 自动提示淡出
  useEffect(() => {
    if (!tip) {
      return;
    }
    const t = window.setTimeout(() => setTip(""), 1600);
    return () => window.clearTimeout(t);
  }, [tip]);

  const needLogin = useCallback(() => {
    router.push("/login");
  }, [router]);

  const handleTime = (cur: number, dur: number) => {
    if (draggingRef.current) {
      return;
    }
    setPb((p) => ({ ...p, cur, dur }));
    if (!token || dur <= 0) {
      return;
    }
    const now = Date.now();
    if (now - lastSave.current > 5000) {
      lastSave.current = now;
      const e = eps[activeIdx];
      if (e && line) {
        void save.send({
          title_id: tid,
          play_source_id: line.id,
          episode_id: e.id,
          episode_idx: e.idx,
          position: Math.floor(cur),
          duration: Math.floor(dur),
        });
      }
    }
  };

  const goNext = () => {
    if (activeIdx < eps.length - 1) {
      const c = scrollRef.current;
      if (c) {
        c.scrollTo({ top: c.clientHeight * (activeIdx + 1), behavior: "smooth" });
      }
      setActiveIdx(activeIdx + 1);
    }
  };

  const togglePlay = () => {
    const v = activeElRef.current;
    if (!v) {
      return;
    }
    if (muted) {
      v.muted = false;
      setMuted(false);
    }
    if (v.paused) {
      v.play().catch(() => undefined);
    } else {
      v.pause();
    }
  };

  const setLike = (on: boolean) => {
    if (!token) {
      needLogin();
      return;
    }
    if (on === liked) {
      return;
    }
    setLiked(on);
    setLikeCount((c) => Math.max(0, c + (on ? 1 : -1)));
    void likeReq.send({ titleId: tid, on });
  };

  const setFav = (on: boolean) => {
    if (!token) {
      needLogin();
      return;
    }
    if (on === favored) {
      return;
    }
    setFavored(on);
    if (on) {
      void favOps.add.send(tid);
    } else {
      void favOps.remove.send(tid);
    }
  };

  // 单击播放/暂停，双击点赞（爱心动画）
  const onStageClick = () => {
    if (tapTimer.current != null) {
      window.clearTimeout(tapTimer.current);
      tapTimer.current = null;
      setHeart((k) => k + 1);
      if (!liked) {
        setLike(true);
      }
    } else {
      tapTimer.current = window.setTimeout(() => {
        tapTimer.current = null;
        togglePlay();
      }, 220);
    }
  };

  const pickLine = (i: number) => {
    setLineIdx(i);
    setActiveIdx(0);
    resumeIdxRef.current = -1;
    const c = scrollRef.current;
    if (c) {
      c.scrollTop = 0;
    }
    if (lines[i]) {
      localStorage.setItem(`yinshi_line_${tid}`, lines[i].flag);
    }
    setSheet("none");
  };

  const pickEpisode = (i: number) => {
    const c = scrollRef.current;
    if (c) {
      c.scrollTop = c.clientHeight * i;
    }
    setActiveIdx(i);
    setSheet("none");
  };

  const onShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: detail.name, url });
      } else {
        await navigator.clipboard.writeText(url);
        setTip("已复制链接");
      }
    } catch {
      /* 用户取消分享 */
    }
  };

  // 进度条拖动定位
  const seekAt = (clientX: number) => {
    const el = trackRef.current;
    const v = activeElRef.current;
    if (!el || !v || pb.dur <= 0) {
      return;
    }
    const r = el.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    v.currentTime = ratio * pb.dur;
    setPb((p) => ({ ...p, cur: ratio * p.dur }));
  };

  const ep = eps[activeIdx];
  const progressPct = pb.dur > 0 ? (pb.cur / pb.dur) * 100 : 0;

  // 9:16 舞台尺寸（手机铺满，桌面居中成手机画面），舞台 / 浮层共用
  const stageSx = {
    position: "relative" as const,
    width: { xs: "100%", md: "auto" },
    height: "100%",
    aspectRatio: { md: "9 / 16" },
    mx: "auto",
  };

  return (
    <Box sx={{ position: "fixed", inset: 0, zIndex: 1300, bgcolor: "#000" }}>
      {/* 滚动信息流：每集一屏，上下滑切集 */}
      <Box
        ref={scrollRef}
        sx={{
          height: "100%",
          overflowY: "auto",
          scrollSnapType: "y mandatory",
          overscrollBehavior: "contain",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {eps.map((e, i) => (
          <Box
            key={e.id}
            ref={(el: HTMLDivElement | null) => {
              sectionRefs.current[i] = el;
            }}
            data-idx={i}
            sx={{
              height: "100%",
              scrollSnapAlign: "start",
              scrollSnapStop: "always",
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box sx={{ ...stageSx, overflow: "hidden", borderRadius: { md: 2 } }} onClick={onStageClick}>
              {i === activeIdx ? (
                <FeedVideo
                  url={e.url}
                  active
                  startAt={i === resumeIdxRef.current ? resumePos : 0}
                  onReady={(el) => {
                    activeElRef.current = el;
                  }}
                  onTime={handleTime}
                  onState={(s) => setPb((p) => ({ ...p, ...s }))}
                  onEnded={goNext}
                  onMuted={setMuted}
                />
              ) : detail.poster ? (
                <Box
                  component="img"
                  src={detail.poster}
                  alt=""
                  sx={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.5 }}
                />
              ) : null}
            </Box>
          </Box>
        ))}
      </Box>

      {/* 固定浮层（与舞台对齐）：返回/标题 + 中央播放图标 + 右侧动作栏 + 底部进度 */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <Box sx={stageSx}>
          {/* 顶部：返回 + 标题 */}
          <Box
            sx={{
              position: "absolute",
              inset: "0 0 auto 0",
              p: 1,
              zIndex: 5,
              display: "flex",
              alignItems: "center",
              gap: 0.5,
              background: "linear-gradient(180deg, rgba(0,0,0,.55), transparent)",
            }}
          >
            <IconButton
              size="small"
              onClick={() => router.push(`/title/${tid}`)}
              sx={{ color: "#fff", pointerEvents: "auto" }}
            >
              <ChevronLeft size={24} />
            </IconButton>
            <Typography
              variant="subtitle2"
              noWrap
              sx={{ color: "#fff", fontWeight: 700, flex: 1, minWidth: 0, textShadow: "0 1px 4px rgba(0,0,0,.7)" }}
            >
              {detail.name}
            </Typography>
          </Box>

          {/* 中央：暂停时的播放图标 */}
          {pb.paused ? (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                zIndex: 4,
                color: "rgba(255,255,255,.85)",
              }}
            >
              <CirclePlay size={72} strokeWidth={1} />
            </Box>
          ) : null}

          {/* 缓冲指示 */}
          {pb.buffering && !pb.paused ? (
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                zIndex: 4,
                pointerEvents: "none",
              }}
            >
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  border: "3px solid rgba(255,255,255,.25)",
                  borderTopColor: "#fff",
                  animation: "sdspin 0.8s linear infinite",
                  "@keyframes sdspin": { to: { transform: "rotate(360deg)" } },
                }}
              />
            </Box>
          ) : null}

          {/* 双击爱心动画 */}
          {heart > 0 ? (
            <Box
              key={heart}
              sx={{
                position: "absolute",
                inset: 0,
                display: "grid",
                placeItems: "center",
                zIndex: 6,
                pointerEvents: "none",
                animation: "sdheart 0.7s ease-out forwards",
                "@keyframes sdheart": {
                  "0%": { transform: "scale(.4)", opacity: 0 },
                  "30%": { transform: "scale(1.15)", opacity: 1 },
                  "100%": { transform: "scale(1)", opacity: 0 },
                },
              }}
            >
              <Heart size={110} fill="#ff4d5e" color="#ff4d5e" />
            </Box>
          ) : null}

          {/* 取消静音提示 */}
          {muted ? (
            <Chip
              icon={<VolumeX size={16} />}
              label="点击取消静音"
              onClick={togglePlay}
              sx={{
                position: "absolute",
                top: 52,
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 6,
                pointerEvents: "auto",
                color: "#fff",
                bgcolor: "rgba(0,0,0,.55)",
                "& .MuiChip-icon": { color: "#fff" },
              }}
            />
          ) : null}

          {/* 右侧动作栏 */}
          <Stack
            spacing={2}
            sx={{ position: "absolute", right: 8, bottom: 96, zIndex: 5, alignItems: "center" }}
          >
            <RailAction
              icon={<Heart size={24} fill={liked ? "#ff4d5e" : "none"} />}
              label={likeCount > 0 ? String(likeCount) : "点赞"}
              active={liked}
              onClick={() => setLike(!liked)}
            />
            <RailAction
              icon={<Bookmark size={24} fill={favored ? "#ffb000" : "none"} />}
              label="收藏"
              active={favored}
              onClick={() => setFav(!favored)}
            />
            <RailAction
              icon={<MessageCircle size={24} />}
              label="评论"
              onClick={() => setSheet("comments")}
            />
            <RailAction
              icon={<ListVideo size={24} />}
              label={`选集·${eps.length}`}
              onClick={() => setSheet("episodes")}
            />
            <RailAction icon={<Share2 size={24} />} label="分享" onClick={() => void onShare()} />
          </Stack>

          {/* 底部：集名 + 进度条 */}
          <Box sx={{ position: "absolute", inset: "auto 0 0 0", zIndex: 5, px: 1.5, pb: 1.5 }}>
            <Typography
              variant="body2"
              sx={{ color: "#fff", fontWeight: 600, mb: 0.8, textShadow: "0 1px 4px rgba(0,0,0,.8)" }}
            >
              {ep ? ep.name : ""}
            </Typography>
            <Box
              ref={trackRef}
              onPointerDown={(e) => {
                draggingRef.current = true;
                (e.target as HTMLElement).setPointerCapture(e.pointerId);
                seekAt(e.clientX);
              }}
              onPointerMove={(e) => {
                if (draggingRef.current) {
                  seekAt(e.clientX);
                }
              }}
              onPointerUp={() => {
                draggingRef.current = false;
              }}
              sx={{
                position: "relative",
                height: 18,
                display: "flex",
                alignItems: "center",
                pointerEvents: "auto",
                cursor: "pointer",
                touchAction: "none",
              }}
            >
              <Box sx={{ position: "relative", width: "100%", height: 3, borderRadius: 2, bgcolor: "rgba(255,255,255,.3)" }}>
                <Box
                  sx={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${progressPct}%`,
                    bgcolor: "#ff4d5e",
                    borderRadius: 2,
                  }}
                />
                <Box
                  sx={{
                    position: "absolute",
                    top: "50%",
                    left: `${progressPct}%`,
                    width: 11,
                    height: 11,
                    borderRadius: "50%",
                    bgcolor: "#fff",
                    transform: "translate(-50%, -50%)",
                  }}
                />
              </Box>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 轻提示 */}
      {tip ? (
        <Box
          sx={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            zIndex: 10,
            px: 2,
            py: 1,
            borderRadius: 2,
            bgcolor: "rgba(0,0,0,.75)",
            color: "#fff",
            fontSize: 14,
          }}
        >
          {tip}
        </Box>
      ) : null}

      {/* 选集 + 线路 抽屉 */}
      <Drawer
        anchor="bottom"
        open={sheet === "episodes"}
        onClose={() => setSheet("none")}
        sx={{ zIndex: 1400 }}
        slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: "72vh", bgcolor: "#15151c" } } }}
      >
        <Box sx={{ p: 2 }}>
          {lines.length > 1 ? (
            <>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                线路（{lines.length}）
              </Typography>
              <Stack
                direction="row"
                spacing={1}
                sx={{ overflowX: "auto", pb: 1, mb: 1.5, "&::-webkit-scrollbar": { display: "none" } }}
              >
                {lines.map((ps, i) => {
                  const dead = ps.health === -1;
                  return (
                    <Chip
                      key={ps.id}
                      label={`${ps.source?.name ?? "线路"}${ps.lang ? " · " + ps.lang : ""}${dead ? " · 失效" : ""}`}
                      color={i === lineIdx ? "primary" : "default"}
                      onClick={() => pickLine(i)}
                      sx={{ flexShrink: 0, opacity: dead ? 0.45 : 1 }}
                    />
                  );
                })}
              </Stack>
            </>
          ) : null}
          <Typography variant="subtitle2" sx={{ mb: 1.5 }}>
            选集（{eps.length}）
          </Typography>
          <Box sx={epGridSx}>
            {eps.map((e, i) => (
              <Button
                key={e.id}
                size="large"
                variant={i === activeIdx ? "contained" : "outlined"}
                onClick={() => pickEpisode(i)}
                sx={epBtnSx}
              >
                {e.name || `第${i + 1}集`}
              </Button>
            ))}
          </Box>
        </Box>
      </Drawer>

      {/* 评论抽屉 */}
      <CommentSheet
        open={sheet === "comments"}
        titleId={tid}
        onClose={() => setSheet("none")}
        onNeedLogin={needLogin}
        loggedIn={Boolean(token)}
        reload={reload}
      />
    </Box>
  );
}

// 评论抽屉：懒加载（打开时才请求）
function CommentSheet({
  open,
  titleId,
  onClose,
  onNeedLogin,
  loggedIn,
  reload,
}: {
  open: boolean;
  titleId: number;
  onClose: () => void;
  onNeedLogin: () => void;
  loggedIn: boolean;
  reload: () => void;
}) {
  const [qid, setQid] = useState(0); // 0 时不请求，打开后置为 titleId
  const { data, send } = useComments(qid);
  const ops = useCommentOps();
  const [text, setText] = useState("");

  useEffect(() => {
    if (open && qid === 0) {
      setQid(titleId);
    }
  }, [open, qid, titleId]);

  const list = data?.list ?? [];

  const submit = async () => {
    if (!loggedIn) {
      onNeedLogin();
      return;
    }
    const content = text.trim();
    if (!content) {
      return;
    }
    try {
      await ops.add.send({ title_id: titleId, content });
      setText("");
      void send();
      reload();
    } catch {
      /* ignore */
    }
  };

  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      sx={{ zIndex: 1400 }}
      slotProps={{ paper: { sx: { borderTopLeftRadius: 16, borderTopRightRadius: 16, height: "72vh", bgcolor: "#15151c" } } }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Typography variant="subtitle2" sx={{ p: 2, pb: 1 }}>
          评论（{data?.total ?? 0}）
        </Typography>
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", px: 2 }}>
          {list.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center", mt: 4 }}>
              还没有评论，来抢沙发～
            </Typography>
          ) : (
            <Stack spacing={2}>
              {list.map((c) => (
                <Stack key={c.id} direction="row" spacing={1.2}>
                  <Avatar src={c.user?.avatar} sx={{ width: 34, height: 34 }}>
                    {c.user?.nickname?.[0] ?? "U"}
                  </Avatar>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary">
                      {c.user?.nickname ?? "用户"}
                    </Typography>
                    <Typography variant="body2">{c.content}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </Box>
        <Stack direction="row" spacing={1} sx={{ p: 1.5, borderTop: "1px solid rgba(255,255,255,.08)" }}>
          <TextField
            size="small"
            fullWidth
            placeholder={loggedIn ? "说点什么…" : "登录后参与评论"}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                void submit();
              }
            }}
          />
          <IconButton color="primary" onClick={() => void submit()} disabled={!text.trim()}>
            <Send size={20} />
          </IconButton>
        </Stack>
      </Box>
    </Drawer>
  );
}
