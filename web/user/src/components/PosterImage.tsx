"use client";
import { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";
import { EyeOff } from "lucide-react";
import Blurhash from "./Blurhash";

// 图床支持的缩放档（与后端 imgWidths 对齐）
const POSTER_WIDTHS = [200, 400, 640];

interface Props {
  src?: string;
  hash?: string;
  alt?: string;
  ratio?: string; // "宽 / 高"，如 "2 / 3"、"16 / 9"
  adult?: boolean; // 成人内容：海报模糊打码 + 标记，点一下才显示
  sizes?: string; // srcset 的 sizes（默认覆盖网格/横排小海报；详情大图等可覆盖）
}

// 海报图：等比容器（百分比 padding，跨浏览器/布局都稳，不会被 grid/flex 拉伸覆盖）
// + BlurHash 占位 + 真图淡入。无论原图比例如何，都裁成统一尺寸。
// adult 时：默认强模糊 + 「成人内容」遮罩，点击遮罩才解锁显示（阻止冒泡，不触发外层跳转）。
export default function PosterImage({
  src,
  hash,
  alt = "",
  ratio = "2 / 3",
  adult = false,
  sizes = "(max-width: 600px) 32vw, (max-width: 1200px) 20vw, 180px",
}: Props) {
  const [loaded, setLoaded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const [w, h] = ratio.split("/").map((s) => Number(s.trim()) || 1);
  const pad = `${(h / w) * 100}%`; // 2/3 → 150%，16/9 → 56.25%
  const masked = adult && !revealed;

  // 图床支持 ?w= 缩放：按显示尺寸取图，移动端不再下整张原图。仅对自有图床地址生成 srcset，
  // 外部源址（不认 ?w）保持原图。
  const canResize = !!src && src.includes("/api/v1/img/");
  const srcSet = canResize
    ? POSTER_WIDTHS.map((pw) => `${src}?w=${pw} ${pw}w`).join(", ")
    : undefined;

  // SSR：服务端渲染的 <img> 常在 React hydrate 前就加载完，onLoad 事件错过 →
  // loaded 永远 false，图片停在 opacity:0、只剩 blurhash。挂载后补查 complete 兜底。
  useEffect(() => {
    const img = imgRef.current;
    if (img?.complete && img.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);
  return (
    <Box
      sx={{
        position: "relative",
        width: "100%",
        height: 0,
        paddingTop: pad,
        bgcolor: "#1c1c26",
        overflow: "hidden",
        borderRadius: "8px",
      }}
    >
      {hash && !loaded ? (
        <Box sx={{ position: "absolute", inset: 0 }}>
          <Blurhash hash={hash} />
        </Box>
      ) : null}
      {src ? (
        <Box
          component="img"
          ref={imgRef}
          src={src}
          srcSet={srcSet}
          sizes={canResize ? sizes : undefined}
          alt={alt}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          sx={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity .45s ease, transform .4s ease, filter .25s ease",
            filter: masked ? "blur(18px)" : "none",
            transform: masked ? "scale(1.12)" : undefined, // 放大遮住模糊产生的透明边
          }}
        />
      ) : null}

      {masked ? (
        <Box
          role="button"
          aria-label="成人内容，点击查看"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setRevealed(true);
          }}
          sx={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 0.5,
            cursor: "pointer",
            color: "rgba(255,255,255,.92)",
            bgcolor: "rgba(0,0,0,.32)",
          }}
        >
          <EyeOff size={22} />
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: 1 }}>
            成人内容
          </Typography>
          <Typography variant="caption" sx={{ opacity: 0.72, fontSize: 10.5 }}>
            点击查看
          </Typography>
        </Box>
      ) : null}
    </Box>
  );
}
