import { useEffect, useRef, useState } from "react";
import { Box, Button } from "@mui/material";
import { MediaPlayer, MediaProvider, type MediaPlayerInstance } from "@vidstack/react";
import {
  DefaultVideoLayout,
  defaultLayoutIcons,
  type DefaultLayoutTranslations,
} from "@vidstack/react/player/layouts/default";
import "@vidstack/react/player/styles/default/theme.css";
import "@vidstack/react/player/styles/default/layouts/video.css";

// 播放器中文化
const zh: Partial<DefaultLayoutTranslations> = {
  Play: "播放",
  Pause: "暂停",
  Mute: "静音",
  Unmute: "取消静音",
  Volume: "音量",
  Settings: "设置",
  Quality: "清晰度",
  Auto: "自动",
  Speed: "播放速度",
  Normal: "正常",
  Playback: "播放",
  Audio: "音轨",
  Captions: "字幕",
  Default: "默认",
  Off: "关闭",
  Fullscreen: "全屏",
  "Enter Fullscreen": "进入全屏",
  "Exit Fullscreen": "退出全屏",
  PiP: "画中画",
  "Enter PiP": "进入画中画",
  "Exit PiP": "退出画中画",
  "Seek Forward": "快进",
  "Seek Backward": "快退",
  Seek: "进度",
  Replay: "重播",
  Continue: "继续",
  LIVE: "直播",
  "Skip To Live": "回到直播",
  Connected: "已连接",
  Disconnected: "已断开",
  Reset: "重置",
};

interface Props {
  url: string;
  startAt?: number; // 续播：可播放后跳到该秒数
  onTime?: (current: number, duration: number) => void;
  onEnded?: () => void; // 播完（用于自动下一集）
  skip?: { introEnd: number; outroStart: number }; // 众包片头/片尾时间（秒，0=无）
  onCurrentTime?: (t: number) => void; // 上报当前时间（用于打点）
  portrait?: boolean; // 短剧竖屏：9:16 播放比例（默认 16:9）
  fill?: boolean; // 沉浸式：铺满父容器（由外层舞台控制尺寸/比例），优先级高于 portrait
}

export default function Player({
  url,
  startAt,
  onTime,
  onEnded,
  skip,
  onCurrentTime,
  portrait,
  fill,
}: Props) {
  const player = useRef<MediaPlayerInstance>(null);
  const [cur, setCur] = useState(0);

  // 进度回传（5s）
  useEffect(() => {
    if (!onTime) {
      return;
    }
    const id = window.setInterval(() => {
      const p = player.current;
      if (p) {
        onTime(p.state.currentTime, p.state.duration || 0);
      }
    }, 5000);
    return () => window.clearInterval(id);
  }, [onTime]);

  // 1s 追踪当前时间（跳过按钮 + 打点上报）
  const needTick = Boolean(skip) || Boolean(onCurrentTime);
  useEffect(() => {
    if (!needTick) {
      return;
    }
    const id = window.setInterval(() => {
      const p = player.current;
      if (p) {
        const t = p.state.currentTime;
        setCur(t);
        onCurrentTime?.(t);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [needTick, onCurrentTime]);

  const showSkipIntro = skip && skip.introEnd > 0 && cur >= 2 && cur < skip.introEnd;
  const showSkipOutro =
    skip && skip.outroStart > 0 && cur >= skip.outroStart && Boolean(onEnded);

  return (
    <Box
      sx={{
        position: "relative",
        ...(fill
          ? { width: "100%", height: "100%" } // 铺满外层舞台
          : portrait
            ? { width: "100%", maxWidth: 420, mx: "auto" } // 竖屏限宽居中，桌面端不铺满
            : { width: "100%" }),
      }}
    >
      <MediaPlayer
        ref={player}
        src={url}
        playsInline
        autoPlay
        onEnded={onEnded}
        onCanPlay={() => {
          if (startAt && startAt > 1 && player.current) {
            player.current.currentTime = startAt;
          }
        }}
        style={
          fill
            ? { width: "100%", height: "100%", background: "#000" }
            : {
                width: "100%",
                aspectRatio: portrait ? "9 / 16" : "16 / 9",
                background: "#000",
              }
        }
      >
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} translations={zh} />
      </MediaPlayer>

      {showSkipIntro ? (
        <Button
          size="small"
          variant="contained"
          onClick={() => {
            if (player.current && skip) {
              player.current.currentTime = skip.introEnd;
            }
          }}
          sx={{
            position: "absolute",
            right: 16,
            bottom: 84,
            zIndex: 50,
            bgcolor: "rgba(0,0,0,.65)",
            backdropFilter: "blur(4px)",
            "&:hover": { bgcolor: "rgba(0,0,0,.8)" },
          }}
        >
          跳过片头
        </Button>
      ) : showSkipOutro ? (
        <Button
          size="small"
          variant="contained"
          onClick={() => onEnded?.()}
          sx={{
            position: "absolute",
            right: 16,
            bottom: 84,
            zIndex: 50,
            bgcolor: "rgba(0,0,0,.65)",
            backdropFilter: "blur(4px)",
            "&:hover": { bgcolor: "rgba(0,0,0,.8)" },
          }}
        >
          下一集 ▶
        </Button>
      ) : null}
    </Box>
  );
}
