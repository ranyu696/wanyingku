import { useEffect, useState } from "react";
import { Alert, Snackbar } from "@mui/material";

// 模块级 toast 单例：组件外（如 alova 拦截器）也能调用。
type Severity = "success" | "error" | "info";
type Msg = { key: number; severity: Severity; text: string };

let seq = 0;
const listeners = new Set<(m: Msg) => void>();

function emit(severity: Severity, text: string) {
  const m = { key: ++seq, severity, text };
  listeners.forEach((l) => l(m));
}

export const toast = {
  success: (t: string) => emit("success", t),
  error: (t: string) => emit("error", t),
  info: (t: string) => emit("info", t),
};

// 挂在应用根部一次，订阅单例并渲染 Snackbar。
export function Toaster() {
  const [msg, setMsg] = useState<Msg | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const l = (m: Msg) => {
      setMsg(m);
      setOpen(true);
    };
    listeners.add(l);
    return () => void listeners.delete(l);
  }, []);
  return (
    <Snackbar
      key={msg?.key}
      open={open}
      autoHideDuration={3000}
      onClose={() => setOpen(false)}
      anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
    >
      <Alert
        severity={msg?.severity ?? "info"}
        variant="filled"
        onClose={() => setOpen(false)}
        sx={{ width: "100%" }}
      >
        {msg?.text}
      </Alert>
    </Snackbar>
  );
}
