"use client";
import { useEffect, useState } from "react";
import { Button, Stack } from "@mui/material";
import { Bell, BellRing, Heart, Play, ThumbsUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useFavoriteOps, useLikeTitle, useSubscribeOps, useTitleDetail } from "@/lib/hooks";
import { useAuth } from "@/store/auth";

// 详情页操作区客户端岛：播放/收藏/点赞/订阅。
// 用户态（收藏/点赞/订阅/进度）服务端匿名取不到 → 登录后客户端再拉一次 /titles/:id 校验。
export default function DetailActions({
  idParam,
  tid,
  kind,
  hasSource,
  initialLikeCount,
}: {
  idParam: string;
  tid: number;
  kind: number;
  hasSource: boolean;
  initialLikeCount: number;
}) {
  const router = useRouter();
  const { token } = useAuth();
  const fav = useFavoriteOps();
  const sub = useSubscribeOps();
  const likeOp = useLikeTitle();
  // 仅登录时拉用户态；匿名不请求（enabled=false）
  const { data } = useTitleDetail(token ? idParam : "");
  const enabled = Boolean(token);

  const [isFav, setIsFav] = useState(false);
  const [isSub, setIsSub] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [resumeIdx, setResumeIdx] = useState(0);
  const [hasProgress, setHasProgress] = useState(false);

  useEffect(() => {
    if (!data) {
      return;
    }
    setIsFav(Boolean(data.is_favorite));
    setIsSub(Boolean(data.is_subscribed));
    setIsLiked(Boolean(data.is_liked));
    setLikeCount(data.detail?.like_count || initialLikeCount);
    setResumeIdx(data.progress?.episode_idx ?? 0);
    setHasProgress(Boolean(data.progress));
  }, [data, initialLikeCount]);

  const requireLogin = () => router.push("/login");
  const goWatch = (ep?: number) =>
    router.push(`/watch/${idParam}${ep != null ? `?ep=${ep}` : ""}`);

  const toggleFav = async () => {
    if (!enabled) {
      requireLogin();
      return;
    }
    try {
      await (isFav ? fav.remove.send(tid) : fav.add.send(tid));
      setIsFav(!isFav);
    } catch {
      /* ignore */
    }
  };
  const toggleSub = async () => {
    if (!enabled) {
      requireLogin();
      return;
    }
    try {
      await (isSub ? sub.remove.send(tid) : sub.add.send(tid));
      setIsSub(!isSub);
    } catch {
      /* ignore */
    }
  };
  const toggleLike = async () => {
    if (!enabled) {
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

  return (
    <Stack direction="row" sx={{ mt: 1.5, flexWrap: "wrap", gap: 1 }}>
      {hasSource ? (
        <Button
          size="small"
          variant="contained"
          color="primary"
          startIcon={<Play size={18} fill="currentColor" />}
          onClick={() => goWatch()}
        >
          {hasProgress && resumeIdx > 0 ? `继续观看 第${resumeIdx}集` : "播放"}
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
      {kind !== 1 ? (
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
  );
}
