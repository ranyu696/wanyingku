import { Box } from "@mui/material";
import type { Title } from "../api/types";
import PosterCard from "./PosterCard";

export default function PosterGrid({ items }: { items: Title[] }) {
  return (
    <Box
      sx={{
        display: "grid",
        // minmax(0,1fr)：防止横版封面等宽内容把列撑爆（1fr 默认是 minmax(auto,1fr)）
        gridTemplateColumns: {
          xs: "repeat(3, minmax(0, 1fr))", // 手机
          sm: "repeat(4, minmax(0, 1fr))", // 平板竖
          md: "repeat(5, minmax(0, 1fr))", // 平板横/小桌面
          lg: "repeat(6, minmax(0, 1fr))", // 桌面
          xl: "repeat(8, minmax(0, 1fr))", // 宽屏
        },
        gap: { xs: 1, sm: 1.5, md: 2 },
        px: { xs: 1.5, md: 2 },
      }}
    >
      {items.map((t) => (
        <PosterCard key={t.id} t={t} />
      ))}
    </Box>
  );
}
