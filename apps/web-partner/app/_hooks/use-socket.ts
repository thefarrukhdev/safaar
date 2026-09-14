"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "../_stores/auth-store";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "/api/backend";
const WS_URL = API_BASE_URL.replace(/\/v\d+$/, "").replace(/\/api$/, "");

export interface UseSocketOptions {
  enabled?: boolean;
}

/**
 * Backend'ning `RealtimeGateway`siga ulanadi. Ulanganda JWT'dagi
 * `organization_id` bo'yicha avtomatik `partner:{organizationId}` xonasiga
 * qo'shiladi (server tomonda) — shu orqali admin tasdiqlash/rad etish kabi
 * hodisalar real vaqtda keladi.
 */
export function useSocket(options?: UseSocketOptions) {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const socketRef = useRef<Socket | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const enabled = options?.enabled !== false;

  useEffect(() => {
    // ── Hamma uchun vaqtincha Demo rejim (Backend ulanmagan) ───────────────
    // Dasturchi vaqtincha backendni to'liq o'chirib qo'yishni so'radi
    return;
    // ────────────────────────────────────────────────────────────────────────

    if (!enabled || typeof window === "undefined" || !accessToken) return;
    
    const nextSocket = io(WS_URL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 50,
    });

    nextSocket.on("connect", () => {
      setConnected(true);
      setSocket(nextSocket);
    });
    nextSocket.on("disconnect", () => {
      setConnected(false);
      setSocket(null);
    });
    nextSocket.on("connect_error", () => {
      setConnected(false);
      setSocket(null);
    });

    socketRef.current = nextSocket;

    return () => {
      nextSocket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [enabled, accessToken]);

  const on = useCallback(
    (event: string, handler: (...args: unknown[]) => void) => {
      const current = socketRef.current;
      if (!current) return;
      current.on(event, handler);
      return () => {
        current.off(event, handler);
      };
    },
    [],
  );

  return { socket, connected, on };
}
