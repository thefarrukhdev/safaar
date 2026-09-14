import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AdminRole } from "@/types/admin";

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  // 2026-09-14: was hardcoded to only 3 of the 6 real backend roles
  // (SUPER_ADMIN/ADMIN/MODERATOR) — FINANCE_ADMIN/CONTENT_ADMIN/
  // SUPPORT_ADMIN silently passed through untyped (`data.admin?.role`
  // in admin-api.ts's login() is effectively `any`). Widened to the
  // same AdminRole used everywhere else so permission-matrix logic can
  // rely on it.
  role: AdminRole;
  has2FA?: boolean;
}

interface AuthState {
  user: AdminUser | null;
  isAuthenticated: boolean;
  login: (user: AdminUser) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      login: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
    }),
    {
      name: "admin-auth-storage",
    }
  )
);
