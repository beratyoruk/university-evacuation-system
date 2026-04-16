import { create } from "zustand";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string, role: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: JSON.parse(localStorage.getItem("user") || "null"),
  token: localStorage.getItem("token"),
  isAuthenticated: !!localStorage.getItem("token"),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axios.post(`${API_URL}/auth/login`, { email, password });
      const { token, user } = res.data.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      const message = axios.isAxiosError(err) ? err.response?.data?.error || "Login failed" : "Login failed";
      set({ error: message, isLoading: false });
    }
  },

  register: async (email, password, name, role) => {
    set({ isLoading: true, error: null });
    try {
      const res = await axios.post(`${API_URL}/auth/register`, { email, password, name, role });
      const { token, user } = res.data.data;
      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(user));
      set({ user, token, isAuthenticated: true, isLoading: false });
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || "Registration failed"
        : "Registration failed";
      set({ error: message, isLoading: false });
    }
  },

  logout: () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({ user: null, token: null, isAuthenticated: false });
  },
}));
