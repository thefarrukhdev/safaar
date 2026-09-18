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
  // rely on it. (develop independently attempted the same fix with an
  // inline union, but used FINANCE/SUPPORT/CONTENT instead of the
  // backend's actual FINANCE_ADMIN/SUPPORT_ADMIN/CONTENT_ADMIN — this
  // shared AdminRole type is the one that actually matches the backend
  // Role enum, so it wins here.)
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
