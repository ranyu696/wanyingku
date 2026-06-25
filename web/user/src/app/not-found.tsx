import { Box, Button, Typography } from "@mui/material";
import Link from "next/link";

// 未匹配路由 / 调用 notFound() 时的 404 页（Next 自动注入 noindex，避免被收录）。
export default function NotFound() {
  return (
    <Box sx={{ py: 10, px: 3, textAlign: "center" }}>
      <Typography variant="h5" sx={{ fontWeight: 800, mb: 1 }}>
        页面不存在
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        你要找的内容可能已下架或地址有误
      </Typography>
      <Link href="/" style={{ textDecoration: "none" }}>
        <Button variant="contained">回首页</Button>
      </Link>
    </Box>
  );
}
