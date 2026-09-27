"use client";

import { useState, useSyncExternalStore, useEffect, useRef } from "react";
import Link from "next/link";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { type PromoBarConfig, getLocalizedText } from "@/lib/promo";
import { PromoShinyText } from "@/components/ui/PromoShinyText";

interface PromoBarProps {
  configs: PromoBarConfig[];
  locale?: string;
}

const emptySubscribe = () => () => {};

export function PromoBar({ configs, locale = "uz" }: PromoBarProps) {
  const [now, setNow] = useState(0);

  useEffect(() => {
    const timer = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(timer);
  }, []);

  const isMounted = useSyncExternalStore(emptySubscribe, () => true, () => false);

  // Per-config dismissal state tracked by id
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => new Set());

  const [currentIndex, setCurrentIndex] = useState(0);

  // Read sessionStorage dismissals once mounted
  useEffect(() => {
    if (!isMounted) return;
    const dismissed = new Set<string>();
    for (const cfg of configs) {
      if (cfg.id && sessionStorage.getItem(`safaar_promo_dismissed_${cfg.id}`) === "1") {
        dismissed.add(cfg.id);
      }
    }
    if (dismissed.size > 0) {
      setDismissedIds(dismissed);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted]);

  // Filter to only active, non-expired, non-dismissed configs
  const visibleConfigs = configs.filter((cfg) => {
    if (!cfg.isActive) return false;
    if (now > 0 && cfg.endsAt && new Date(cfg.endsAt).getTime() < now) return false;
    if (isMounted && cfg.id && dismissedIds.has(cfg.id)) return false;
    const text = getLocalizedText(cfg.text, locale);
    if (!text) return false;
    return true;
  });

  // Keep currentIndex in bounds when visible list shrinks
  const safeIndex = visibleConfigs.length > 0 ? currentIndex % visibleConfigs.length : 0;

  // Auto-advance carousel
  const indexRef = useRef(safeIndex);
  indexRef.current = safeIndex;

  useEffect(() => {
    if (visibleConfigs.length <= 1) return;
    const id = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % visibleConfigs.length);
    }, 3500);
    return () => clearInterval(id);
  // visibleConfigs.length is the only stable dep we need here
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleConfigs.length]);

  if (visibleConfigs.length === 0) return null;

  const config = visibleConfigs[safeIndex];

  const text = getLocalizedText(config.text, locale);
  const badgeText = getLocalizedText(config.badge, locale);
  const linkText = getLocalizedText(config.linkText, locale);
  const isDismissible = config.isDismissible ?? true;

  const handleDismiss = () => {
    if (!config.id) return;
    const id = config.id;
    sessionStorage.setItem(`safaar_promo_dismissed_${id}`, "1");
    setDismissedIds((prev) => new Set(prev).add(id));
    // Move to the next promo if possible
    setCurrentIndex((prev) => {
      const nextVisible = configs.filter((c) => {
        if (!c.isActive) return false;
        if (now > 0 && c.endsAt && new Date(c.endsAt).getTime() < now) return false;
        if (c.id === id) return false;
        if (c.id && dismissedIds.has(c.id)) return false;
        return !!getLocalizedText(c.text, locale);
      });
      if (nextVisible.length === 0) return 0;
      return prev % nextVisible.length;
    });
  };

  return (
    <div
      role="region"
      aria-label="Promo banner"
      className="relative flex min-h-[36px] flex-col items-center justify-center bg-primary-950/95 px-8 py-1.5 text-center text-xs font-semibold text-white shadow-md backdrop-blur-md transition-all duration-300 sm:text-sm"
    >
      {/* Animated slide content */}
      <div
        key={safeIndex}
        className="flex flex-wrap items-center justify-center gap-1.5 animate-in fade-in slide-in-from-bottom-1 duration-500 sm:gap-2"
      >
        {badgeText ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-amber-400 shadow-xs backdrop-blur-md sm:text-xs">
            <Sparkles className="h-3 w-3 text-amber-400" aria-hidden />
            {badgeText}
          </span>
        ) : (
          <Sparkles className="hidden h-3.5 w-3.5 animate-pulse text-amber-400 sm:inline" aria-hidden />
        )}

        <PromoShinyText className="line-clamp-1 drop-shadow-xs">{text}</PromoShinyText>

        {config.link && (
          <Link
            href={config.link}
            className="ml-1 inline-flex items-center gap-0.5 rounded-sm font-bold text-amber-400 underline underline-offset-2 hover:text-amber-300 focus:outline-hidden focus:ring-1 focus:ring-amber-400"
          >
            <span>{linkText || "Batafsil"}</span>
            <ArrowRight className="h-3 w-3" aria-hidden />
          </Link>
        )}
      </div>

      {/* Dot indicators — only shown when there are multiple visible promos */}
      {visibleConfigs.length > 1 && (
        <div className="mt-1 flex items-center gap-1" aria-hidden>
          {visibleConfigs.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrentIndex(i)}
              className={[
                "rounded-full transition-all duration-300 focus:outline-none",
                i === safeIndex
                  ? "h-1.5 w-3 bg-white opacity-100"
                  : "h-1 w-1 bg-white/50 opacity-60 hover:opacity-80",
              ].join(" ")}
              aria-label={`Promo ${i + 1}`}
            />
          ))}
        </div>
      )}

      {/* Dismiss button */}
      {isDismissible && isMounted && (
        <button
          type="button"
          onClick={handleDismiss}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-white/80 transition-colors hover:bg-white/20 hover:text-white focus:outline-hidden focus:ring-1 focus:ring-white"
          aria-label="E'lonni yopish"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
