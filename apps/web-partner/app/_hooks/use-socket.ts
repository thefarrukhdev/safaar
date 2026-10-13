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
  const listenersRef = useRef<Map<string, Set<(...args: unknown[]) => void>>>(new Map());
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const enabled = options?.enabled !== false;

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !accessToken) return;

    const nextSocket = io(WS_URL, {
      auth: { token: accessToken },
      transports: ["websocket", "polling"],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 50,
    });

    socketRef.current = nextSocket;

    const listeners = listenersRef.current;

    // Rebind all registered event listeners to the active socket
    listeners.forEach((handlers, event) => {
      handlers.forEach((handler) => {
        nextSocket.on(event, handler);
      });
    });

    nextSocket.on("connect", () => {
      setConnected(true);
      setSocket(nextSocket);
    });
    nextSocket.on("disconnect", () => {
      setConnected(false);
    });
    nextSocket.on("connect_error", () => {
      setConnected(false);
    });

    return () => {
      listeners.forEach((handlers, event) => {
        handlers.forEach((handler) => {
          nextSocket.off(event, handler);
        });
      });
      nextSocket.disconnect();
      socketRef.current = null;
      setConnected(false);
      setSocket(null);
    };
  }, [enabled, accessToken]);

  const on = useCallback(
    (event: string, handler: (...args: unknown[]) => void) => {
      let handlers = listenersRef.current.get(event);
      if (!handlers) {
        handlers = new Set();
        listenersRef.current.set(event, handlers);
      }
      handlers.add(handler);

      // If socket is already instantiated, bind immediately
      const current = socketRef.current;
      if (current) {
        current.on(event, handler);
      }

      return () => {
        const set = listenersRef.current.get(event);
        set?.delete(handler);
        if (set && set.size === 0) {
          listenersRef.current.delete(event);
        }
        socketRef.current?.off(event, handler);
      };
    },
    [],
  );

  return { socket, connected, on };
}
