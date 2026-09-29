"use client";

import { useState, useEffect } from "react";
import { WifiOff, RefreshCw, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function OfflineRetryControl({
  locale,
  homeText = "Bosh sahifaga",
  retryText = "Qayta ulanishni tekshirish",
}: {
  locale: string;
  homeText?: string;
  retryText?: string;
}) {
  const [checking, setChecking] = useState(false);
  const [online, setOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      // Faqatgina haqiqatdan offline holatiga tushgan bo'lsa qayta yuklasin.
      // Aks holda ba'zi brauzerlar ishga tushishi bilan "online" berib cheksiz refresh qilib tashlaydi.
      if (!navigator.onLine) return; // if it's not actually online, ignore
      
      setOnline(true);
      // Biz endi avtomatik reload qilmaymiz, yoki shunchaki state ni o'zgartiramiz
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, [locale]);

  const handleRetry = async () => {
    setChecking(true);
    try {
      // `api.health.ping()` (if available) or checking the backend instead of the local page
      // but keeping it simple with a HEAD request and no-store is standard for ping.
      // We will use standard Next.js fetch with a cache busting query instead of hitting Next Router cache.
      const res = await fetch(`/${locale}?ping=${Date.now()}`, { cache: "no-store", method: "HEAD" });
      if (res.ok) {
        setOnline(true);
        window.location.href = `/${locale}`;
        return;
      }
    } catch {
      /* still offline */
    } finally {
      setTimeout(() => setChecking(false), 600);
    }
  };

  if (online) {
    return (
      <div className="flex flex-col items-center gap-3 animate-in fade-in zoom-in duration-300">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600  ">
          <CheckCircle2 className="h-8 w-8 stroke-[2.5]" />
        </div>
        <p className="font-bold text-emerald-700 ">
          Internet aloqasi tiklandi! Qayta yuklanmoqda...
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500 shadow-inner  ">
        <WifiOff className="h-8 w-8 stroke-[2]" />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button
          size="lg"
          variant="primary"
          onClick={handleRetry}
          loading={checking}
          className="gap-2 font-bold shadow-md"
        >
          <RefreshCw className={`h-4 w-4 ${checking ? "animate-spin" : ""}`} />
          {retryText}
        </Button>

        <a href={`/${locale}`}>
          <Button size="lg" variant="secondary" className="font-semibold">
            {homeText}
          </Button>
        </a>
      </div>
    </div>
  );
}
