"use client";

import { useState, useEffect } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/Button";

import type { CommonDict } from "@/i18n/dictionaries";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PwaInstallBanner({ dict }: { dict?: CommonDict["pwa"] }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!deferredPrompt || dismissed) {
    return null;
  }

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="fixed bottom-2 left-2 right-2 z-50 mx-auto max-w-sm animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-2 rounded-[18px] border border-slate-200/60 bg-white/95 p-2 shadow-xl backdrop-blur-xl dark:border-slate-800/60 dark:bg-slate-900/95">
        
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-gradient-to-br from-primary-400 to-primary-600 text-white shadow-sm">
          <Smartphone className="h-5 w-5" />
        </div>
        
        <div className="flex min-w-0 flex-1 flex-col justify-center pl-1">
          <span className="truncate text-[13px] font-bold leading-tight text-slate-900 dark:text-white">
            {dict?.installTitle || "Safaar ilovasini o'rnating"}
          </span>
          <span className="truncate text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-400 mt-0.5">
            {dict?.installSubtitle || "Tezkor kirish va offlayn rejim"}
          </span>
        </div>

        <Button
          size="sm"
          variant="primary"
          onClick={handleInstall}
          className="h-7 shrink-0 rounded-[10px] px-3 text-[11px] font-bold shadow-none"
        >
          {dict?.installButton || "O'rnatish"}
        </Button>

        <button
          type="button"
          onClick={() => setDismissed(true)}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          aria-label="Yopish"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
