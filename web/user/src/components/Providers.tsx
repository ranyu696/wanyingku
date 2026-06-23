"use client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { theme } from "@/theme";
import EmotionRegistry from "./EmotionRegistry";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <EmotionRegistry>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </EmotionRegistry>
  );
}
