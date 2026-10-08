# Hamkor Autentifikatsiyasi Xavfsizligi — Frontend Integratsiya Qo'llanmasi

Ushbu qo'llanma **frontend (`apps/web-partner`)** dasturchisi (`@adhambek7717`) uchun mo'ljallangan. Senior Cyber Security talablariga muvofiq, backendda amalga oshirilgan 3 ta asosiy xavfsizlik yangilanishini frontend ilovaga to'g'ri integratsiya qilish bo'yicha tayyor kodlar va yo'riqnomalarni o'z ichiga oladi:

1. **`HttpOnly, Secure, SameSite=Lax` Cookie orqali Refresh Token boshqaruvi**
2. **7 kunlik Absolute Timeout (Qat'iy muddat)**
3. **1-2 soatlik Idle Timeout (Harakatsizlik taymeri) va Ogohlantirish Modali**

---

## 1. Arxitektura va Xavfsizlik Tushuntirishi

| Komponent | Oldingi holat | Yangi Xavfsiz holat | Nega o'zgartirildi? |
|---|---|---|---|
| **Refresh Token saqlanishi** | `localStorage` / response body | `HttpOnly, Secure, SameSite=Lax` Cookie | XSS (Cross-Site Scripting) orqali token o'g'irlanishi xavfini 100% yo'qotish (JavaScript cookieni o'qiy olmaydi). |
| **Token Refresh so'rovi** | Body'da `{ refreshToken }` yuborilgan | Brauzer cookieni avtomatik yuboradi (`credentials: 'include'`) | Brauzer xavfsiz kanaldan foydalanadi. Retro-moslashuvchanlik uchun body'dagi token ham qabul qilinadi. |
| **Sessiya maksimal umri (Absolute)** | Cheksiz uzaytirish (har 30 kunda) | **Qat'iy 7 kun (Absolute Lifetime)** | Token har 15 daqiqada yangilanib tursa ham, birinchi kirishdan boshlab 7 kundan keyin qayta login majburiy qilinadi. |
| **Harakatsizlik (Idle Timeout)** | Mavjud emas edi | **60 daqiqa (1 soat)** harakatsizlikdan so'ng avtomatik logout | Hamkor kompyuterni ochiq qoldirib ketganda begona shaxslar ma'lumotlarni ko'ra olmasligi uchun. |

---

## 2. Cookie orqali Token Refresh — So'rovlarni Sozlash

Backendda quyidagi endpointlar `Set-Cookie` orqali `refresh_token`ni avtomatik o'rnatadi va o'chiradi:
- `POST /v1/auth/partner/login`
- `POST /v1/auth/partner/password-login`
- `POST /v1/auth/partner/email-otp/verify`
- `POST /v1/auth/partner/phone-login`
- `POST /v1/auth/partner/set-password`
- `POST /v1/auth/otp/verify` (hamkor OTP tasdiqlash alias)
- `POST /v1/auth/partner/refresh`
- `POST /v1/auth/partner/logout` (Cookieni tozalaydi)

### A. Fetch API uchun sozlash

Har qanday backend so'rovida `credentials: 'include'` parametri ko'rsatilishi shart:

```typescript
// Tokenni yangilash so'rovi
export async function refreshPartnerToken(): Promise<{ accessToken: string }> {
  const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/v1/auth/partner/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    // MUHIM: Cookielar serverga yetib borishi va yangi Set-Cookie qabul qilinishi uchun
    credentials: 'include',
    // Body'da token jo'natish shart emas! Backend req.cookies['refresh_token'] dan avtomatik oladi.
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    throw new Error('REFRESH_FAILED');
  }

  const payload = await response.json();
  const data = payload.data ?? payload;
  return { accessToken: data.accessToken };
}
```

### B. Axios uchun sozlash (Interceptors bilan)

Agar loyihada `axios` ishlatilayotgan bo'lsa, `withCredentials: true` ni yoqing:

```typescript
// lib/api-client.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1',
  // Barcha so'rovlarda Cookie yuborilishi shart:
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let inMemoryAccessToken: string | null = null;

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

// Request interceptor: accessToken mavjud bo'lsa sarlavhaga qo'shish
apiClient.interceptors.request.use((config) => {
  if (inMemoryAccessToken && config.headers) {
    config.headers.Authorization = `Bearer ${inMemoryAccessToken}`;
  }
  return config;
});

// Response interceptor: 401 bo'lganda avtomatik refresh qilish
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Refresh so'rovining o'zi 401 bersa (masalan 7 kunlik muddat tugagan bo'lsa)
    if (originalRequest.url?.includes('/auth/partner/refresh')) {
      setAccessToken(null);
      if (typeof window !== 'undefined') {
        window.location.href = '/login?reason=session_expired';
      }
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Body bo'sh yuboriladi, cookie avtomatik ilova qilinadi
        const refreshRes = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1'}/auth/partner/refresh`,
          {},
          { withCredentials: true },
        );

        const newAccessToken =
          refreshRes.data?.data?.accessToken ?? refreshRes.data?.accessToken;
        setAccessToken(newAccessToken);
        processQueue(null, newAccessToken);

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return apiClient(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        setAccessToken(null);
        if (typeof window !== 'undefined') {
          window.location.href = '/login?reason=session_expired';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  },
);
```

---

## 3. Idle Timeout (Harakatsizlik Taymeri — 1-2 soat)

### Ishlash prinsipi:
1. Standart muddat: **60 daqiqa (3600 soniya)**.
2. Ogohlantirish muddati: Muddat tugashidan **2 daqiqa oldin** (58-daqiqada) ekranda ogohlantirish modali ochiladi.
3. Foydalanuvchi "Sessiyani davom ettirish" tugmasini bossa yoki sahifada biror harakat qilsa (mouse, klaviatura, touch, scroll), taymer boshidan boshlanadi.
4. **Multi-Tab sinxronizatsiya**: Agar hamkor brauzerda bir nechta tab ochgan bo'lsa va 1-tabda ishlayotgan bo'lsa, 2-tabda kutilmaganda logout bo'lib ketmasligi uchun harakatlar `localStorage` orqali tablararo sinxronlashtiriladi.
5. Taymer tugagach: Avtomatik ravishda `POST /v1/auth/partner/logout` chaqiriladi va `/login?reason=idle_timeout`ga yo'naltiriladi.

### A. Tayyor React Hook: `hooks/useIdleTimeout.ts`

Ushbu kodni to'g'ridan-to'g'ri `apps/web-partner/src/hooks/useIdleTimeout.ts` fayliga joylashtirishingiz mumkin:

```typescript
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api-client';

interface UseIdleTimeoutOptions {
  /** Jami harakatsizlik vaqti millisekundlarda (standart: 60 daqiqa = 3_600_000 ms) */
  timeoutMs?: number;
  /** Ogohlantirish berish vaqti muddat tugashidan oldin (standart: 2 daqiqa = 120_000 ms) */
  promptBeforeMs?: number;
  /** Foydalanuvchi tizimga kirganmi? (Faqat kirgan bo'lsa taymer ishlaydi) */
  isAuthenticated: boolean;
}

export function useIdleTimeout({
  timeoutMs = 60 * 60 * 1000, // 60 daqiqa (1 soat)
  promptBeforeMs = 2 * 60 * 1000, // 2 daqiqa
  isAuthenticated,
}: UseIdleTimeoutOptions) {
  const router = useRouter();
  const [isPromptOpen, setIsPromptOpen] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(
    Math.round(promptBeforeMs / 1000),
  );

  const lastActivityKey = 'safaar_partner_last_activity';
  const lastThrottleRef = useRef<number>(0);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Oxirgi harakat vaqtini yangilash
  const recordActivity = useCallback(() => {
    const now = Date.now();
    // Resurslarni tejash uchun har 1 soniyada ko'pi bilan 1 marta yangilaymiz
    if (now - lastThrottleRef.current > 1000) {
      lastThrottleRef.current = now;
      if (typeof window !== 'undefined') {
        localStorage.setItem(lastActivityKey, now.toString());
      }
      if (isPromptOpen) {
        setIsPromptOpen(false);
      }
    }
  }, [isPromptOpen]);

  // Tizimdan to'liq chiqish (Logout)
  const handleLogout = useCallback(async () => {
    try {
      await apiClient.post('/auth/partner/logout', {});
    } catch {
      // Xatolik bo'lsa ham frontend tarafda tozalashni davom ettiramiz
    } finally {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(lastActivityKey);
        window.location.href = '/login?reason=idle_timeout';
      }
    }
  }, []);

  // Sessiyani davom ettirish tugmasi bosilganda
  const stayLoggedIn = useCallback(() => {
    recordActivity();
    setIsPromptOpen(false);
  }, [recordActivity]);

  useEffect(() => {
    if (!isAuthenticated) return;

    // Boshlang'ich vaqtni belgilash
    if (typeof window !== 'undefined' && !localStorage.getItem(lastActivityKey)) {
      localStorage.setItem(lastActivityKey, Date.now().toString());
    }

    const events = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];

    const handleUserActivity = () => {
      // Agar ogohlantirish modali ochilmagan bo'lsa, harakat taymerni yangilaydi
      if (!isPromptOpen) {
        recordActivity();
      }
    };

    events.forEach((event) => {
      window.addEventListener(event, handleUserActivity, { passive: true });
    });

    // Har 1 soniyada holatni tekshirish
    checkIntervalRef.current = setInterval(() => {
      const storedLastActivity = Number(
        localStorage.getItem(lastActivityKey) || Date.now(),
      );
      const now = Date.now();
      const timeElapsed = now - storedLastActivity;
      const timeLeft = timeoutMs - timeElapsed;

      if (timeLeft <= 0) {
        // Vaqt to'liq tugadi — avtomatik logout
        if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
        handleLogout();
      } else if (timeLeft <= promptBeforeMs) {
        // Ogohlantirish vaqti keldi
        setIsPromptOpen(true);
        setRemainingSeconds(Math.max(1, Math.round(timeLeft / 1000)));
      } else {
        // Vaqt yetarli
        if (isPromptOpen) setIsPromptOpen(false);
      }
    }, 1000);

    // Multi-tab sync: boshqa tabda harakat bo'lganda bu tabda ham yangilansin
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === lastActivityKey) {
        if (isPromptOpen) {
          setIsPromptOpen(false);
        }
      }
    };
    window.addEventListener('storage', handleStorageChange);

    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, handleUserActivity);
      });
      window.removeEventListener('storage', handleStorageChange);
      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }
    };
  }, [isAuthenticated, isPromptOpen, timeoutMs, promptBeforeMs, recordActivity, handleLogout]);

  return {
    isPromptOpen,
    remainingSeconds,
    stayLoggedIn,
    handleLogout,
  };
}
```

---

### B. Ogohlantirish Modali Komponenti: `components/IdleTimeoutModal.tsx`

```tsx
'use client';

import React from 'react';

interface IdleTimeoutModalProps {
  isOpen: boolean;
  remainingSeconds: number;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export function IdleTimeoutModal({
  isOpen,
  remainingSeconds,
  onStayLoggedIn,
  onLogout,
}: IdleTimeoutModalProps) {
  if (!isOpen) return null;

  const minutes = Math.floor(remainingSeconds / 60);
  const seconds = remainingSeconds % 60;
  const formattedTime = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-zinc-900">
        <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
          <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-950/60">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            Sessiya tugash arafasida
          </h3>
        </div>

        <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">
          Siz ancha vaqtdan beri harakatsizsiz. Xavfsizlik maqsadida
          sessiyangiz yana <span className="font-bold text-amber-600 dark:text-amber-400">{formattedTime}</span> soniyadan
          so'ng avtomatik yopiladi.
        </p>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onLogout}
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Chiqish
          </button>
          <button
            type="button"
            onClick={onStayLoggedIn}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            Sessiyani davom ettirish
          </button>
        </div>
      </div>
    </div>
  );
}
```

---

### C. Dashboard / Layout integratsiyasi

`apps/web-partner/src/app/(dashboard)/layout.tsx` (yoki asosiy Dashboard Provider):

```tsx
'use client';

import { useIdleTimeout } from '@/hooks/useIdleTimeout';
import { IdleTimeoutModal } from '@/components/IdleTimeoutModal';
import { useAuth } from '@/context/AuthContext'; // mavjud auth konteksti

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAuth();

  const { isPromptOpen, remainingSeconds, stayLoggedIn, handleLogout } =
    useIdleTimeout({
      timeoutMs: 60 * 60 * 1000, // 1 soat harakatsizlik
      promptBeforeMs: 2 * 60 * 1000, // 2 daqiqa oldin ogohlantirish
      isAuthenticated: Boolean(isAuthenticated),
    });

  return (
    <div>
      {children}
      <IdleTimeoutModal
        isOpen={isPromptOpen}
        remainingSeconds={remainingSeconds}
        onStayLoggedIn={stayLoggedIn}
        onLogout={handleLogout}
      />
    </div>
  );
}
```

---

## 4. Sinov va QA Nazorat Ro'yxati (Testing Checklist)

Frontend dasturchisi tekshirishi kerak bo'lgan asosiy test holatlari:

- [ ] **1. DevTools Cookies tekshiruvi:**
  - Login qilgandan so'ng `F12` > `Application` > `Cookies` bo'limida `refresh_token` paydo bo'lganini tekshiring.
  - `HttpOnly` ustunida belgi (checkmark) bo'lishi kerak.
  - `SameSite` ustuni `Lax` bo'lishi kerak.
  - Konsolda `document.cookie` deb yozilganda `refresh_token` **ko'rinmasligi** kerak (bu uning JS'dan to'liq himoyalanganini bildiradi).
- [ ] **2. Token yangilanishi (Refresh) tekshiruvi:**
  - Network tabda `POST /v1/auth/partner/refresh` chaqirilganda, Request Headers'da `Cookie: refresh_token=...` borligini tekshiring.
  - Response Headers'da yangilangan `Set-Cookie: refresh_token=...` kelishini tekshiring.
- [ ] **3. Logout tekshiruvi:**
  - Logout qilinganda `POST /v1/auth/partner/logout` chaqirilib, cookie darhol tozalanishi (o'chirilishi) kerak.
- [ ] **4. Idle Timeout sinovi (Tezkor test):**
  - Test qilish uchun vaqtinchalik `timeoutMs: 15 * 1000` (15s) va `promptBeforeMs: 5 * 1000` (5s) qilib tekshirib ko'ring:
    1. 10 soniya sichqonchaga tegilmasa, ogohlantirish modali ochilishi kerak.
    2. "Sessiyani davom ettirish" bosilsa, modal yopilib taymer yangilanishi kerak.
    3. Hech narsa bosilmasa, 5 soniyadan so'ng login sahifasiga yo'naltirishi kerak.
- [ ] **5. Multi-Tab sinxronizatsiya:**
  - Partner panelni ikkita alohida tabda oching.
  - 1-tabda sahifani aylantirib turing — 2-tabda ogohlantirish chiqmasligi va sessiya o'chib ketmasligi kerak.
