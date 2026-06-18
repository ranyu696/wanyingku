import { Box, CircularProgress, Typography } from "@mui/material";

export function Loading() {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
      <CircularProgress size={28} />
    </Box>
  );
}

export function Empty({ text = "暂无数据" }: { text?: string }) {
  return (
    <Box sx={{ textAlign: "center", color: "text.secondary", py: 6 }}>
      <Typography variant="body2">{text}</Typography>
    </Box>
  );
}
