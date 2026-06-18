import { useCallback, useEffect, useRef, useState } from "react";
import { Box, Button, Chip, IconButton, Stack, Typography } from "@mui/material";
import { ChevronLeft, Heart, Share2 } from "lucide-react";
import { useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useFavoriteOps, useSaveProgress, useSubmitSkip, useTitleDetail } from "../api/hooks";
import Comments from "../components/Comments";
import Player from "../components/Player";
import ShortDramaFeed from "../components/ShortDramaFeed";
import { Empty, Loading } from "../components/State";
import { epBtnSx, epGridSx } from "../format";
import { useAuth } from "../store/auth";
import { useSeo } from "../seo";

// 播放器/短剧信息流仅浏览器可用（vidstack/hls），但模块本身在 Node 可安全 import；
// 靠下方 mounted 闸门保证服务端只渲染 Loading、不渲染它们，故用静态 import（避免 lazy 分包导致 React 双实例）。

// 秒 → mm:ss
function fmt(s: number): string {
  if (!s || s <= 0) {
    return "--:--";
  }
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${m}:${ss.toString().padStart(2, "0")}`;
}

// 播放页：详情页点「播放/某一集」后才进来，这里才有播放器。
// 短剧（kind=6）走 9:16 竖屏沉浸式信息流（ShortDramaFeed），其余走横屏：播放器铺满 + 线路/选集。
// 简介/评论/相关/演职员都在详情页，这里只管「看」。
export default function Watch() {
  const { id } = useParams({ from: "/watch/$id" });
  const search = useSearch({ from: "/watch/$id" });
  const { data, loading, send } = useTitleDetail(id);
  const nav = useNavigate();
  const { token } = useAuth();
  const save = useSaveProgress();
  const submitSkip = useSubmitSkip();
  const fav = useFavoriteOps();
  const [lineIdx, setLineIdx] = useState(0);
  const [epIdx, setEpIdx] = useState(0);
  const [resumePos, setResumePos] = useState(0);
  const appliedRef = useRef(false);
  const curRef = useRef(0);
  const [marking, setMarking] = useState(false);
  const [introMark, setIntroMark] = useState(0);
  const [outroMark, setOutroMark] = useState(0);
  const [epPage, setEpPage] = useState(0); // 选集分段（集数多时 1-40/41-80…）
  const [isFav, setIsFav] = useState(false);
  const [mounted, setMounted] = useState(false); // 播放页纯客户端：SSR 与首屏统一渲染 Loading，避开懒加载播放器的水合不一致

  const detail = data?.detail;
  const isShort = detail?.kind === 6; // 短剧：9:16 竖屏沉浸式
  const tid = detail?.id ?? 0;
  const lines = detail?.play_sources ?? [];
  const line = lines[lineIdx];
  const eps = line?.episodes ?? [];
  const ep = eps[epIdx];
  useSeo(detail ? `${detail.name}${ep ? " " + ep.name : ""} 在线播放` : undefined);
  const EP_PAGE = 40;
  const ePages = Math.max(1, Math.ceil(eps.length / EP_PAGE));
  const ePageCur = Math.min(epPage, ePages - 1);
  const epView = eps.slice(ePageCur * EP_PAGE, ePageCur * EP_PAGE + EP_PAGE);

  // 起播定位（只应用一次）：URL 指定的集 > 上次进度 > 记忆线路
  useEffect(() => {
    if (!data || appliedRef.current) {
      return;
    }
    appliedRef.current = true;
    const ls = data.detail.play_sources || [];
    if (search.line != null && ls[search.line]) {
      setLineIdx(search.line);
    }
    if (search.ep != null) {
      setEpIdx(search.ep);
      setResumePos(0);
      return;
    }
    if (data.progress) {
      const li = ls.findIndex((ps) => ps.id === data.progress?.play_source_id);
      if (li >= 0) {
        setLineIdx(li);
        const ei = ls[li].episodes.findIndex((e) => e.idx === data.progress?.episode_idx);
        if (ei >= 0) {
          setEpIdx(ei);
        }
        setResumePos(data.progress.position || 0);
      }
    } else {
      const savedFlag = localStorage.getItem(`yinshi_line_${data.detail.id}`);
      if (savedFlag) {
        const li = ls.findIndex((ps) => ps.flag === savedFlag);
        if (li >= 0) {
          setLineIdx(li);
        }
      }
    }
  }, [data, search]);

  // 选集面板自动跳到当前集所在段
  useEffect(() => {
    setEpPage(Math.floor(epIdx / EP_PAGE));
  }, [epIdx]);

  // 收藏初始态
  useEffect(() => {
    if (data) {
      setIsFav(Boolean(data.is_favorite));
    }
  }, [data]);

  useEffect(() => {
    setMounted(true);
  }, []);

  const onTime = useCallback(
    (cur: number, dur: number) => {
      if (!token || !ep || !line) {
        return;
      }
      void save.send({
        title_id: tid,
        play_source_id: line.id,
        episode_id: ep.id,
        episode_idx: ep.idx,
        position: Math.floor(cur),
        duration: Math.floor(dur),
      });
    },
    [token, ep, line, tid, save],
  );

  if (!mounted || (loading && !detail)) {
    return <Loading />;
  }
  if (!detail) {
    return <Empty text="影片不存在" />;
  }
  if (lines.length === 0) {
    return <Empty text="暂无播放源" />;
  }

  // 短剧：整页交给 9:16 竖屏沉浸式信息流（自带选集/线路/评论/手势控件）
  if (isShort && data) {
    return <ShortDramaFeed resp={data} reload={() => void send()} />;
  }

  const pickEpisode = (i: number) => {
    setEpIdx(i);
    setResumePos(0);
  };
  const pickLine = (i: number) => {
    setLineIdx(i);
    setEpIdx(0);
    setResumePos(0);
    if (lines[i]) {
      localStorage.setItem(`yinshi_line_${tid}`, lines[i].flag);
    }
  };
  const handleEnded = () => {
    if (epIdx < eps.length - 1) {
      setEpIdx(epIdx + 1);
      setResumePos(0);
    }
  };
  const openMarking = () => {
    setIntroMark(data?.skip?.intro_end ?? 0);
    setOutroMark(data?.skip?.outro_start ?? 0);
    setMarking(true);
  };
  const submitMark = async () => {
    if (!token) {
      void nav({ to: "/login" });
      return;
    }
    try {
      await submitSkip.send({ titleId: tid, intro_end: introMark, outro_start: outroMark });
      setMarking(false);
      void send();
    } catch {
      /* ignore */
    }
  };
  const toggleFav = async () => {
    if (!token) {
      void nav({ to: "/login" });
      return;
    }
    try {
      await (isFav ? fav.remove.send(tid) : fav.add.send(tid));
      setIsFav(!isFav);
    } catch {
      /* ignore */
    }
  };
  const onShare = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title: detail.name, url });
      } else {
        await navigator.clipboard.writeText(url);
      }
    } catch {
      /* 用户取消 */
    }
  };

  // 分段标签（集数多时）
  const rangeTabs =
    ePages > 1 ? (
      <Stack
        direction="row"
        spacing={0.8}
        sx={{ mb: 1, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" } }}
      >
        {Array.from({ length: ePages }).map((_, p) => {
          const a = p * EP_PAGE + 1;
          const b = Math.min((p + 1) * EP_PAGE, eps.length);
          return (
            <Chip
              key={p}
              size="small"
              label={`${a}-${b}`}
              color={p === ePageCur ? "primary" : "default"}
              variant={p === ePageCur ? "filled" : "outlined"}
              onClick={() => setEpPage(p)}
              sx={{ flexShrink: 0 }}
            />
          );
        })}
      </Stack>
    ) : null;

  return (
    <Box sx={{ pb: 3 }}>
      {/* 顶部条：返回 + 标题 + 收藏/分享 */}
      <Stack direction="row" sx={{ px: 1, py: 0.8, gap: 0.3, alignItems: "center" }}>
        <IconButton
          size="small"
          onClick={() => void nav({ to: "/title/$id", params: { id } })}
          sx={{ color: "text.primary" }}
        >
          <ChevronLeft size={22} />
        </IconButton>
        <Typography variant="subtitle1" noWrap sx={{ fontWeight: 700, minWidth: 0, flex: 1 }}>
          {detail.name}
          {ep ? ` · ${ep.name}` : ""}
        </Typography>
        <IconButton
          size="small"
          onClick={() => void toggleFav()}
          sx={{ color: isFav ? "primary.main" : "text.secondary" }}
        >
          <Heart size={20} fill={isFav ? "currentColor" : "none"} />
        </IconButton>
        <IconButton size="small" onClick={() => void onShare()} sx={{ color: "text.secondary" }}>
          <Share2 size={20} />
        </IconButton>
      </Stack>

      {/* 播放器铺满容器：黑色舞台占满整宽，视频在可视高度内尽量放大居中（影院模式） */}
      <Box sx={{ bgcolor: "#000", display: "flex", justifyContent: "center" }}>
        <Box sx={{ width: "100%", maxWidth: { md: "calc((100vh - 150px) * 16 / 9)" } }}>
          {ep ? (
            <Player
              url={ep.url}
              startAt={resumePos}
              onTime={onTime}
              onEnded={handleEnded}
              skip={
                data?.skip
                  ? { introEnd: data.skip.intro_end, outroStart: data.skip.outro_start }
                  : undefined
              }
              onCurrentTime={(t) => {
                curRef.current = t;
              }}
            />
          ) : null}
        </Box>
      </Box>

      {/* 线路 + 选集 */}
      <Box sx={{ px: { xs: 1.5, md: 2 }, mt: 2 }}>
        {lines.length > 0 ? (
          <>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              线路（{lines.length}）
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ overflowX: "auto", pb: 1, "&::-webkit-scrollbar": { display: "none" } }}
            >
              {lines.map((ps, i) => {
                const dead = ps.health === -1;
                const lat = ps.health === 1 && ps.latency_ms ? ` · ${ps.latency_ms}ms` : "";
                return (
                  <Chip
                    key={ps.id}
                    label={`${ps.source?.name ?? "线路"}${ps.lang ? " · " + ps.lang : ""}${
                      dead ? " · 失效" : lat
                    }`}
                    color={i === lineIdx ? "primary" : "default"}
                    onClick={() => pickLine(i)}
                    sx={{ flexShrink: 0, opacity: dead ? 0.45 : 1 }}
                  />
                );
              })}
            </Stack>
          </>
        ) : null}

        {eps.length > 0 ? (
          <>
            <Typography variant="subtitle2" sx={{ mt: 1.5, mb: 1 }}>
              选集（{eps.length}）
            </Typography>
            {rangeTabs}
            <Box sx={epGridSx}>
              {epView.map((e, j) => {
                const i = ePageCur * EP_PAGE + j;
                return (
                  <Button
                    key={e.id}
                    size="large"
                    variant={i === epIdx ? "contained" : "outlined"}
                    onClick={() => pickEpisode(i)}
                    sx={epBtnSx}
                  >
                    {e.name || `第${i + 1}集`}
                  </Button>
                );
              })}
            </Box>
          </>
        ) : null}

        {/* 众包标记片头片尾 */}
        {ep ? (
          <Box sx={{ mt: 2 }}>
            {!marking ? (
              <Button
                size="small"
                variant="text"
                onClick={openMarking}
                sx={{ color: "text.secondary" }}
              >
                ⏱ 标记片头片尾
                {data?.skip && (data.skip.intro_end > 0 || data.skip.outro_start > 0)
                  ? `（当前 片头 ${fmt(data.skip.intro_end)} / 片尾 ${fmt(data.skip.outro_start)}）`
                  : "（帮大家省时间）"}
              </Button>
            ) : (
              <Box
                sx={{
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: "rgba(255,255,255,.04)",
                  border: "1px solid",
                  borderColor: "divider",
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
                  播到片头结束 / 片尾开始时点对应按钮，提交后所有人共享（取中位数去噪）
                </Typography>
                <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", gap: 1, mb: 1 }}>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setIntroMark(Math.floor(curRef.current))}
                  >
                    片头结束 = 此刻{introMark > 0 ? ` (${fmt(introMark)})` : ""}
                  </Button>
                  <Button
                    size="small"
                    variant="outlined"
                    onClick={() => setOutroMark(Math.floor(curRef.current))}
                  >
                    片尾开始 = 此刻{outroMark > 0 ? ` (${fmt(outroMark)})` : ""}
                  </Button>
                </Stack>
                <Stack direction="row" spacing={1}>
                  <Button
                    size="small"
                    variant="contained"
                    onClick={() => void submitMark()}
                    disabled={submitSkip.loading || (introMark === 0 && outroMark === 0)}
                  >
                    提交
                  </Button>
                  <Button size="small" onClick={() => setMarking(false)}>
                    取消
                  </Button>
                </Stack>
              </Box>
            )}
          </Box>
        ) : null}

        {/* 评论区 */}
        <Comments titleId={tid} />
      </Box>
    </Box>
  );
}
