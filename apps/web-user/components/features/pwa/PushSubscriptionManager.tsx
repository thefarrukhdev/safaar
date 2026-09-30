"use client";

import { useState, useEffect } from "react";
import { Bell, BellCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { config } from "@/lib/config";
import { getSession } from "@/lib/auth/session";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

const PUBLIC_VAPID_KEY = "BEl62iUYgUivxIkv69yViEuiBIa1L1-17k5K3n6T0_wz6t4x-web-push-public-key";

export function PushSubscriptionManager({
  className,
}: {
  className?: string;
}) {
  const [supported, setSupported] = useState(false);
  
  useEffect(() => {
    const timer = setTimeout(() => {
      setSupported(typeof window !== "undefined" && "serviceWorker" in navigator && "Notification" in window);
    }, 0);
    return () => clearTimeout(timer);
  }, []);
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (supported && Notification.permission === "granted") {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          if (sub) setSubscribed(true);
        });
      });
    }
  }, [supported]);

  const handleSubscribe = async () => {
    if (!supported) return;
    setLoading(true);

    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setLoading(false);
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      let subscription = await registration.pushManager.getSubscription();

      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY) as unknown as BufferSource,
        });
      }

      const session = await getSession();
      if (session) {
        const base = config.apiUrl.endsWith("/") ? config.apiUrl : `${config.apiUrl}/`;
        const url = new URL("notifications/push-tokens", base).toString();
        await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.accessToken}`,
          },
          body: JSON.stringify({
            token: JSON.stringify(subscription),
            platform: "web",
          }),
        }).catch(() => null);
      }

      setSubscribed(true);
    } catch {
      /* ignore errors gracefully */
    } finally {
      setLoading(false);
    }
  };

  if (!supported) return null;

  return (
    <div className={className}>
      {subscribed ? (
        <div className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-bold text-emerald-700   ">
          <BellCheck className="h-4 w-4 stroke-[2.5]" />
          Push-bildirishnomalar yoqilgan
        </div>
      ) : (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSubscribe}
          disabled={loading}
          className="gap-2 font-bold shadow-xs"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Bell className="h-3.5 w-3.5" />
          )}
          Bildirishnomalarni yoqish
        </Button>
      )}
    </div>
  );
}
