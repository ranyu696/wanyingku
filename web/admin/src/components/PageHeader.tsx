import type { ReactNode } from "react";
import { Box, Stack, Typography } from "@mui/material";

// 统一页头：品牌色竖条 + 标题 + 可选副标题 + 右侧操作槽
export default function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <Stack direction="row" sx={{ alignItems: "flex-start", gap: 2, mb: 2.5 }}>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" sx={{ alignItems: "center", gap: 1 }}>
          <Box sx={{ width: 3, height: 18, borderRadius: 1, bgcolor: "primary.main" }} />
          <Typography variant="h6" sx={{ fontWeight: 800 }}>
            {title}
          </Typography>
        </Stack>
        {subtitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, ml: 2 }}>
            {subtitle}
          </Typography>
        ) : null}
      </Box>
      {action ? <Box sx={{ flexShrink: 0 }}>{action}</Box> : null}
    </Stack>
  );
}
