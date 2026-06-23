import { alpha, createTheme } from "@mui/material/styles";

// 影视风主题：双色光晕背景、渐变主色辉光、圆润磨砂、定制滚动条
const primary = "#ff3d5a"; // 影院红
const secondary = "#8b5cf6"; // 霓虹紫
const bg = "#08080c";
const paper = "#14141d";

export const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: primary },
    secondary: { main: secondary },
    success: { main: "#22d3ee" },
    warning: { main: "#fbbf24" },
    background: { default: bg, paper },
    text: { primary: "#f6f6fb", secondary: "#a2a2b4" },
    divider: "rgba(255,255,255,0.07)",
  },
  shape: { borderRadius: 16 },
  typography: {
    fontFamily:
      'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif',
    h4: { fontWeight: 800, letterSpacing: -0.5 },
    h5: { fontWeight: 800, letterSpacing: -0.5 },
    h6: { fontWeight: 700, letterSpacing: -0.3 },
    subtitle1: { fontWeight: 700 },
    subtitle2: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: {
          backgroundColor: bg,
          backgroundImage: `
            radial-gradient(900px 480px at 10% -6%, ${alpha(primary, 0.16)}, transparent 60%),
            radial-gradient(820px 480px at 92% 0%, ${alpha(secondary, 0.13)}, transparent 62%)
          `,
          backgroundAttachment: "fixed",
        },
        "::selection": { background: alpha(primary, 0.45) },
        "*::-webkit-scrollbar": { width: 8, height: 8 },
        "*::-webkit-scrollbar-thumb": {
          background: "rgba(255,255,255,0.14)",
          borderRadius: 8,
        },
        "*::-webkit-scrollbar-track": { background: "transparent" },
      },
    },
    MuiPaper: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiCard: {
      defaultProps: { elevation: 0 },
      styleOverrides: {
        root: {
          backgroundColor: paper,
          border: "1px solid rgba(255,255,255,0.07)",
          borderRadius: 18,
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: { root: { borderRadius: 12 } },
      variants: [
        {
          props: { variant: "contained", color: "primary" },
          style: {
            background: `linear-gradient(135deg, ${primary}, #ff7a3d)`,
            boxShadow: `0 6px 20px ${alpha(primary, 0.35)}`,
          },
        },
      ],
    },
    MuiChip: { styleOverrides: { root: { borderRadius: 9, fontWeight: 600 } } },
    MuiAppBar: { styleOverrides: { root: { backgroundImage: "none" } } },
    MuiDialog: { styleOverrides: { paper: { backgroundImage: "none", borderRadius: 20 } } },
    MuiLinearProgress: { styleOverrides: { root: { borderRadius: 4 } } },
  },
});
