"use client"; // 错误边界必须是客户端组件

import { useEffect } from "react";
import { Box, Button, Typography } from "@mui/material";

// 根错误边界：任一页面/流式内容意外抛错时显示，unstable_retry 重新取数+重渲染（治 Go API 偶发抛错）。
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <Box sx={{ py: 10, px: 3, textAlign: "center" }}>
      <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
        出错了
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        页面加载失败，请重试
      </Typography>
      <Button variant="contained" onClick={() => unstable_retry()}>
        重试
      </Button>
    </Box>
  );
}
