"use client";
import { useEffect, useRef } from "react";
import { decode } from "blurhash";

interface Props {
  hash: string;
  punch?: number;
}

// 把 BlurHash 解码到 canvas，作为图片加载前的模糊占位。
export default function Blurhash({ hash, punch = 1 }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) {
      return;
    }
    try {
      const w = 32;
      const h = 48;
      const pixels = decode(hash, w, h, punch);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        return;
      }
      const imageData = ctx.createImageData(w, h);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      /* 非法 hash，忽略 */
    }
  }, [hash, punch]);
  return (
    <canvas
      ref={ref}
      width={32}
      height={48}
      style={{ width: "100%", height: "100%", display: "block" }}
    />
  );
}
