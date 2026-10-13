'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AuthTokens, Role } from '@safaar/types';

export const AUTH_STORAGE_KEY = 'safaar-partner-auth';
export const LEGACY_AUTH_STORAGE_KEY = 'uzbron-partner-auth';

// Initial client hydration vaqtida eski kalitdan yangi kalitga ko'chirish
if (typeof window !== 'undefined') {
  try {
    if (!localStorage.getItem(AUTH_STORAGE_KEY)) {
      const legacy = localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
      if (legacy) {
        localStorage.setItem(AUTH_STORAGE_KEY, legacy);
      }
    }
  } catch {}
}

export interface AuthUser {
  id: string;
  phone: string;
  email?: string;
  fullName: string;
  role: Role;
  organizationId?: string;
  partnerType?: string;
  requiresCompanyDetails?: boolean;
}

interface AuthState {
  user: AuthUser | null;
  tokens: AuthTokens | null;
  setSession: (user: AuthUser, tokens: AuthTokens) => void;
  updateUser: (
    patch: Partial<
      Pick<AuthUser, 'fullName' | 'phone' | 'email' | 'partnerType' | 'requiresCompanyDetails'>
    >,
  ) => void;
  clearSession: () => void;
  setAccessToken: (accessToken: string) => void;
}

/**
 * Hamkor sessiyasi.
 *
 * NOTE: hozircha tokenlar `localStorage`'da saqlanadi (skelet bosqichi).
 * Production'da `refreshToken`'ni httpOnly cookie'ga ko'chiramiz.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      setSession: (user, tokens) => set({ user, tokens }),
      updateUser: (patch) =>
        set((state) =>
          state.user ? { user: { ...state.user, ...patch } } : state,
        ),
      clearSession: () => set({ user: null, tokens: null }),
      setAccessToken: (accessToken) =>
        set((state) =>
          state.tokens ? { tokens: { ...state.tokens, accessToken } } : state,
        ),
    }),
    {
      name: AUTH_STORAGE_KEY,
      storage: createJSONStorage(() => ({
        getItem: (name) => {
          if (typeof localStorage === 'undefined') return null;
          const value = localStorage.getItem(name);
          if (value !== null) return value;
          if (name === AUTH_STORAGE_KEY) {
            const legacyValue = localStorage.getItem(LEGACY_AUTH_STORAGE_KEY);
            if (legacyValue !== null) {
              try {
                localStorage.setItem(AUTH_STORAGE_KEY, legacyValue);
              } catch {}
              return legacyValue;
            }
          }
          return null;
        },
        setItem: (name, value) => {
          if (typeof localStorage !== 'undefined') {
            localStorage.setItem(name, value);
          }
        },
        removeItem: (name) => {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem(name);
            if (name === AUTH_STORAGE_KEY) {
              localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY);
            }
          }
        },
      })),
      version: 2,
      migrate: () => ({ user: null, tokens: null }),
    },
  ),
);
