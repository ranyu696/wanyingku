import { useState } from "react";
import { Box, Typography } from "@mui/material";
import { EyeOff } from "lucide-react";
import Blurhash from "./Blurhash";

interface Props {
  src?: string;
  hash?: string;
  alt?: string;
  ratio?: string; // "宽 / 高"，如 "2 / 3"、"16 / 9"
  adult?: boolean; // 成人内容：海报模糊打码 + 标记，点一下才显示
}

// 海报图：等比容器（百分比 padding，跨浏览器/布局都稳，不会被 grid/flex 拉伸覆盖）
// + BlurHash 占位 + 真图淡入。无论原图比例如何，都裁成统一尺寸。
// adult 时：默认强模糊 + 「成人内容」遮罩，点击遮罩才解锁显示（阻止冒泡，不触发外层跳转）。
export default function PosterImage({ src, hash, alt = "", ratio = "2 / 3", adult = false }: Props) {
  const [loaded, setLoaded] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [w, h] = ratio.split("/").map((s) => Number(s.trim()) || 1);
  const pad = `${(h / w) * 100}%`; // 2/3 → 150%，16/9 → 56.25%
  const masked = adult && !revealed;
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
          src={src}
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
