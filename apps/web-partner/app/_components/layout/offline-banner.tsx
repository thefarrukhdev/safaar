"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { WifiOff, Wifi, RefreshCw, X } from "lucide-react";
import { cn } from "../../_lib/utils/cn";

function subscribe(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

function getSnapshot() {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
}

function getServerSnapshot() {
  return true;
}

/**
 * Internet aloqasi holatini kuzatuvchi reaktiv hook.
 * SSR va React 19 da hydration mismatch bo'lmasligi uchun useSyncExternalStore ishlatadi.
 */
export function useOnlineStatus(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

function OfflineAlert({ onRetry }: { onRetry: () => Promise<unknown> }) {
  const [isDismissed, setIsDismissed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  if (isDismissed) return null;

  const handleManualRetry = async () => {
    setIsRetrying(true);
    try {
      await onRetry();
    } catch {
      // Tarmoq hali ham mavjud emas
    } finally {
      setTimeout(() => setIsRetrying(false), 500);
    }
  };

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        "fixed top-0 inset-x-0 z-[100] px-4 py-2.5 text-xs sm:text-sm font-medium",
        "bg-amber-600/95 dark:bg-amber-700/95 backdrop-blur-md text-white shadow-lg",
        "border-b border-amber-500/50 flex items-center justify-between gap-3",
        "animate-in fade-in slide-in-from-top-2 duration-200",
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span className="relative flex h-2.5 w-2.5 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
        </span>
        <WifiOff className="h-4 w-4 shrink-0 text-amber-200" />
        <span className="truncate">
          Internet aloqasi mavjud emas. Kiritilgan ma'lumotlar saqlanmasligi
          mumkin.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleManualRetry}
          disabled={isRetrying}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold",
            "bg-white/20 hover:bg-white/30 text-white transition-colors min-h-[32px]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
            isRetrying && "opacity-75 cursor-wait",
          )}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isRetrying && "animate-spin")}
          />
          <span>Tekshirish</span>
        </button>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded-md text-amber-200 hover:text-white hover:bg-white/10 transition-colors"
          title="Bannerni yopish"
          aria-label="Bannerni yopish"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Tarmoq uzilishi chidamliligi (Offline Resilience) banneri.
 * - Internet uzilganda xodim kiritayotgan ma'lumotlar yo'qolmasligi uchun ogohlantiradi.
 * - Qayta ulanganda barcha React Query so'rovlarini avtomatik revalidate qiladi va
 *   silliq muvaffaqiyat bildirishnomasini ko'rsatadi.
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus();
  const queryClient = useQueryClient();
  const wasOfflineRef = useRef(false);
  const [showRestored, setShowRestored] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      wasOfflineRef.current = true;
    } else if (wasOfflineRef.current) {
      // Aloqa tiklandi: barcha faol so'rovlarni avtomatik qayta yuborish
      queryClient.refetchQueries({ type: "active" });
      wasOfflineRef.current = false;
      setShowRestored(true);

      const timer = setTimeout(() => {
        setShowRestored(false);
      }, 3500);

      return () => clearTimeout(timer);
    }
  }, [isOnline, queryClient]);

  // Agar aloqa tiklangan bo'lsa, qisqa muddatli yashil banner
  if (showRestored && isOnline) {
    return (
      <div
        role="status"
        aria-live="polite"
        className={cn(
          "fixed top-0 inset-x-0 z-[100] px-4 py-2 text-xs sm:text-sm font-medium",
          "bg-emerald-600 text-white shadow-md flex items-center justify-between",
          "animate-in fade-in slide-in-from-top-2 duration-200",
        )}
      >
        <div className="flex items-center gap-2 mx-auto">
          <Wifi className="h-4 w-4 animate-bounce" />
          <span>Internet aloqasi tiklandi. Ma'lumotlar yangilanmoqda...</span>
        </div>
      </div>
    );
  }

  // Agar offline bo'lsa
  if (!isOnline) {
    return (
      <OfflineAlert onRetry={() => queryClient.refetchQueries({ type: "active" })} />
    );
  }

  return null;
}
