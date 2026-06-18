import { create } from "zustand";
import { TOKEN_KEY } from "../api/client";

interface AuthState {
  token: string | null;
  setToken: (t: string) => void;
  logout: () => void;
}

export const useAuth = create<AuthState>((set) => ({
  token: localStorage.getItem(TOKEN_KEY),
  setToken: (t) => {
    localStorage.setItem(TOKEN_KEY, t);
    set({ token: t });
  },
  logout: () => {
    localStorage.removeItem(TOKEN_KEY);
    set({ token: null });
  },
}));
