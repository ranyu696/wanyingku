import { create } from "zustand";
import { TOKEN_KEY, USER_KEY } from "../api/client";
import type { User } from "../api/types";

// SSR 安全：服务端没有 localStorage，统一走这个守卫
const ls: Storage | null = typeof localStorage === "undefined" ? null : localStorage;

function readUser(): User | null {
  try {
    const raw = ls?.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: ls?.getItem(TOKEN_KEY) ?? null,
  user: readUser(),
  setAuth: (token, user) => {
    ls?.setItem(TOKEN_KEY, token);
    ls?.setItem(USER_KEY, JSON.stringify(user));
    set({ token, user });
  },
  logout: () => {
    ls?.removeItem(TOKEN_KEY);
    ls?.removeItem(USER_KEY);
    set({ token: null, user: null });
  },
}));
