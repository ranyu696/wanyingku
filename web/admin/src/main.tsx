import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline, ThemeProvider, createTheme } from "@mui/material";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import { Toaster } from "./components/Toast";
import "./index.css";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#ff4d5e" },
    secondary: { main: "#7c5cff" },
    background: { default: "#0a0a0f", paper: "#15151f" },
    divider: "rgba(255,255,255,0.08)",
  },
  shape: { borderRadius: 12 },
  typography: { button: { textTransform: "none", fontWeight: 600 } },
  components: {
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: {
      styleOverrides: {
        root: { border: "1px solid rgba(255,255,255,0.07)", borderRadius: 14 },
      },
    },
    MuiButton: { defaultProps: { disableElevation: true } },
    // 表格统一：紧凑 + 斑马纹 + hover
    MuiTable: { defaultProps: { size: "small" } },
    MuiTableCell: {
      styleOverrides: {
        root: { borderColor: "rgba(255,255,255,0.06)", paddingTop: 8, paddingBottom: 8 },
        head: {
          backgroundColor: "#15151f",
          fontWeight: 700,
          color: "rgba(255,255,255,0.7)",
          fontSize: 12.5,
          whiteSpace: "nowrap",
        },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        root: {
          "&:nth-of-type(odd)": { backgroundColor: "rgba(255,255,255,0.022)" },
          "&:hover": { backgroundColor: "rgba(255,255,255,0.05)" },
        },
      },
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <RouterProvider router={router} />
      <Toaster />
    </ThemeProvider>
  </StrictMode>,
);
