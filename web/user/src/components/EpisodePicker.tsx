"use client";
import { useState } from "react";
import { Box, Chip, Stack, Typography } from "@mui/material";
import Link from "next/link";
import type { Episode } from "@/lib/types";

// 详情页选集客户端岛：集数多时分段（1-40/41-80…），每集是跳播放页的链接（带 ?ep=i）。
const EP_PAGE = 40;

export default function EpisodePicker({ idParam, eps }: { idParam: string; eps: Episode[] }) {
  const [epPage, setEpPage] = useState(0);
  const epPages = Math.max(1, Math.ceil(eps.length / EP_PAGE));
  const curEpPage = Math.min(epPage, epPages - 1);
  const epStart = curEpPage * EP_PAGE;
  const epSlice = eps.slice(epStart, epStart + EP_PAGE);

  return (
    <>
      {epPages > 1 ? (
        <Stack
          direction="row"
          spacing={0.8}
          sx={{ mb: 1.2, overflowX: "auto", "&::-webkit-scrollbar": { display: "none" } }}
        >
          {Array.from({ length: epPages }).map((_, p) => {
            const a = p * EP_PAGE + 1;
            const b = Math.min((p + 1) * EP_PAGE, eps.length);
            return (
              <Chip
                key={p}
                size="small"
                label={`${a}-${b}`}
                color={p === curEpPage ? "primary" : "default"}
                variant={p === curEpPage ? "filled" : "outlined"}
                onClick={() => setEpPage(p)}
                sx={{ flexShrink: 0 }}
              />
            );
          })}
        </Stack>
      ) : null}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr 1fr",
            sm: "repeat(3, 1fr)",
            md: "repeat(4, 1fr)",
          },
          gap: 1,
        }}
      >
        {epSlice.map((e, j) => {
          const i = epStart + j;
          return (
            <Link
              key={e.id}
              href={`/watch/${idParam}?ep=${i}`}
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.8,
                  px: 1,
                  py: 0.9,
                  borderRadius: 1.5,
                  border: "1px solid",
                  borderColor: "divider",
                  cursor: "pointer",
                  transition: "border-color .15s, background .15s",
                  "&:hover": { borderColor: "primary.main", bgcolor: "rgba(255,255,255,.03)" },
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 20, textAlign: "right" }}>
                  {i + 1}
                </Typography>
                <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                  {e.name}
                </Typography>
              </Box>
            </Link>
          );
        })}
      </Box>
    </>
  );
}
