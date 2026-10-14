"use client";

import { useEffect, useId, useState } from "react";
import { cn } from "../../_lib/utils/cn";

export interface OccupancyMeterProps {
  /** To'liqlik ko'rsatkichi — 0..100 */
  percent: number;
  /** Ko'rinish uslubi: 'bar' (chiziqli) yoki 'ring' (Apple Watch activity halqasi) */
  variant?: "bar" | "ring";
  /** O'lcham */
  size?: "sm" | "md" | "lg";
  /** Micro-tick belgilari (25%, 50%, 75%) ko'rsatilsinmi */
  showTicks?: boolean;
  /** Apple Watch uslubidagi neon yog'du (glow) effekti */
  showGlow?: boolean;
  /** Silliq dinamik animatsiya */
  animated?: boolean;
  /** Qo'shimcha CSS sinflari */
  className?: string;
  /** Ring rejimidagi markaziy kontent */
  children?: React.ReactNode;
}

/**
 * Apple Watch / Linear uslubidagi yuqori aniqlikdagi dinamik bandlik (occupancy) o'lchagichi.
 * 
 * - ≥80%: Apple Fitness Emerald / Cyan gradienti (faol va barqaror)
 * - 50..79%: Sunset Amber / Orange gradienti (o'rtacha bandlik)
 * - <50%: Apple Energy Rose / Crimson gradienti (past bandlik)
 */
export function OccupancyMeter({
  percent,
  variant = "bar",
  size = "md",
  showTicks,
  showGlow = true,
  animated = true,
  className,
  children,
}: OccupancyMeterProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(percent)));
  const [mounted, setMounted] = useState(!animated);
  const rawId = useId();
  const gradientId = rawId.replace(/[^a-zA-Z0-9_-]/g, "");

  // Mount bo'lganda animatsiyani ishga tushirish (React 19 / Compiler compliant)
  useEffect(() => {
    if (!animated) return;
    const raf = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(raf);
  }, [animated]);

  const displayValue = animated ? (mounted ? clamped : 0) : clamped;

  // Gradient & Glow ranglari
  const getScheme = (val: number) => {
    if (val >= 80) {
      return {
        barGradient: "bg-gradient-to-r from-emerald-500 via-teal-400 to-cyan-400",
        glowColor: "rgba(52, 211, 153, 0.4)",
        ringStart: "#10b981",
        ringEnd: "#06b6d4",
        tipColor: "bg-cyan-200",
      };
    }
    if (val >= 50) {
      return {
        barGradient: "bg-gradient-to-r from-amber-500 via-orange-400 to-rose-400",
        glowColor: "rgba(251, 146, 60, 0.4)",
        ringStart: "#f59e0b",
        ringEnd: "#f43f5e",
        tipColor: "bg-amber-100",
      };
    }
    return {
      barGradient: "bg-gradient-to-r from-rose-500 via-red-500 to-pink-500",
      glowColor: "rgba(244, 63, 94, 0.35)",
      ringStart: "#f43f5e",
      ringEnd: "#db2777",
      tipColor: "bg-rose-100",
    };
  };

  const scheme = getScheme(clamped);

  // ─── APPLE WATCH ACTIVITY RING VARIANTI ───
  if (variant === "ring") {
    const ringConfig = {
      sm: { dimension: 56, strokeWidth: 5, radius: 22 },
      md: { dimension: 76, strokeWidth: 7, radius: 30 },
      lg: { dimension: 104, strokeWidth: 9, radius: 42 },
    }[size];

    const circumference = 2 * Math.PI * ringConfig.radius;
    const strokeDashoffset = circumference - (displayValue / 100) * circumference;

    return (
      <div
        className={cn("relative inline-flex items-center justify-center select-none", className)}
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={clamped}
        aria-label={`To'liqlik: ${clamped}%`}
      >
        <svg
          width={ringConfig.dimension}
          height={ringConfig.dimension}
          className="-rotate-90 transform"
        >
          <defs>
            <linearGradient id={`grad-${gradientId}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor={scheme.ringStart} />
              <stop offset="100%" stopColor={scheme.ringEnd} />
            </linearGradient>
            {showGlow && (
              <filter id={`glow-${gradientId}`} x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor={scheme.ringStart} floodOpacity="0.45" />
              </filter>
            )}
          </defs>

          {/* Fon / Track halqasi */}
          <circle
            cx={ringConfig.dimension / 2}
            cy={ringConfig.dimension / 2}
            r={ringConfig.radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={ringConfig.strokeWidth}
            className="text-zinc-200/70 dark:text-zinc-800/80"
          />

          {/* Faol progress halqasi */}
          <circle
            cx={ringConfig.dimension / 2}
            cy={ringConfig.dimension / 2}
            r={ringConfig.radius}
            fill="transparent"
            stroke={`url(#grad-${gradientId})`}
            strokeWidth={ringConfig.strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap={displayValue > 0 ? "round" : "butt"}
            filter={showGlow && clamped > 0 ? `url(#glow-${gradientId})` : undefined}
            style={{
              transition: animated ? "stroke-dashoffset 850ms cubic-bezier(0.16, 1, 0.3, 1)" : "none",
            }}
          />
        </svg>

        {/* Ichki qiymat / Kontent */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {children || (
            <span
              className={cn(
                "font-bold tracking-tight text-zinc-900 dark:text-white tabular-nums",
                size === "sm" ? "text-xs" : size === "md" ? "text-sm" : "text-lg",
              )}
            >
              {clamped}%
            </span>
          )}
        </div>
      </div>
    );
  }

  // ─── LINEAR / APPLE SLEEK PROGRESS BAR VARIANTI ───
  const barHeights = {
    sm: "h-2",
    md: "h-2.5",
    lg: "h-3.5",
  };

  const tipSizes = {
    sm: "h-1 w-1",
    md: "h-1.5 w-1.5",
    lg: "h-2 w-2",
  };

  const hasTicks = showTicks ?? (size !== "sm");

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden rounded-full",
        // Apple tactile recessed track
        "bg-zinc-200/80 dark:bg-zinc-800/90",
        "shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] dark:shadow-[inset_0_1px_2px_rgba(0,0,0,0.4)]",
        "border border-zinc-950/5 dark:border-white/5",
        barHeights[size],
        className,
      )}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      aria-label={`To'liqlik: ${clamped}%`}
    >
      {/* Micro-ticks (25%, 50%, 75% da yengil ajratgichlar) */}
      {hasTicks && (
        <div className="pointer-events-none absolute inset-0 z-10" aria-hidden>
          <div className="absolute left-1/4 top-0 bottom-0 w-px bg-zinc-900/25 dark:bg-white/20" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-zinc-900/25 dark:bg-white/20" />
          <div className="absolute left-3/4 top-0 bottom-0 w-px bg-zinc-900/25 dark:bg-white/20" />
        </div>
      )}

      {/* Faol to'ldiruvchi progress qatlami */}
      <div
        className={cn(
          "relative h-full rounded-full transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
          scheme.barGradient,
        )}
        style={{
          width: `${displayValue}%`,
          boxShadow: showGlow && clamped > 0 ? `0 0 10px 1px ${scheme.glowColor}` : undefined,
        }}
      >
        {/* Yuqori qismdagi Apple shisha jilosi (specular gloss) */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-gradient-to-b from-white/35 to-transparent" />

        {/* Progress boshidagi yorug'lik nuqtasi (illuminated head) */}
        {clamped > 3 && (
          <div
            className={cn(
              "absolute right-0.5 top-1/2 -translate-y-1/2 rounded-full shadow-[0_0_6px_rgba(255,255,255,0.9)]",
              tipSizes[size],
              scheme.tipColor,
            )}
            aria-hidden
          />
        )}
      </div>
    </div>
  );
}
