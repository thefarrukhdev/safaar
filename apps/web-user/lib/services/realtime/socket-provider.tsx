"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io, type Socket } from "socket.io-client";
import { config } from "@/lib/config/config";

const WS_URL = config.apiUrl.replace(/\/v\d+$/, "").replace(/\/api$/, "");

type EventHandler = (...args: unknown[]) => void;

interface RealtimeContextValue {
  connected: boolean;
  accessToken: string | null;
  on: (event: string, handler: EventHandler) => (() => void) | undefined;
}

const RealtimeContext = createContext<RealtimeContextValue>({
  connected: false,
  accessToken: null,
  on: () => undefined,
});

/**
 * Butun sayt uchun bitta umumiy WebSocket ulanishi. Token berilsa (kirgan
 * foydalanuvchi) backend uni avtomatik `user:{userId}` xonasiga qo'shadi —
 * shaxsiy hodisalar (bron holati, qo'llab-quvvatlash xabari) shu orqali
 * keladi. Token berilmasa ham ulanish davom etadi — promo-kod kabi umumiy
 * (hammaga ochiq) hodisalar baribir keladi.
 */
export function RealtimeProvider({
  children,
  accessToken,
}: {
  children: ReactNode;
  accessToken?: string | null;
}) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const socket = io(WS_URL, {
      auth: accessToken ? { token: accessToken } : undefined,
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 50,
    });

    socket.on("connect", () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));
    socket.on("connect_error", () => setConnected(false));

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [accessToken]);

  const on = useCallback((event: string, handler: EventHandler) => {
    const socket = socketRef.current;
    if (!socket) return undefined;
    socket.on(event, handler);
    return () => {
      socket.off(event, handler);
    };
  }, []);

  return (
    <RealtimeContext.Provider
      value={{ connected, accessToken: accessToken ?? null, on }}
    >
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtime() {
  return useContext(RealtimeContext);
}

/** Bitta hodisani obuna bo'lish uchun qulay hook. */
export function useRealtimeEvent(
  event: string,
  handler: EventHandler,
  deps: readonly unknown[] = [],
) {
  const { on } = useRealtime();

  useEffect(() => {
    const off = on(event, handler);
    return off;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event, on, ...deps]);
}
