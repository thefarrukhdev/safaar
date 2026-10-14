"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  X,
  Loader2,
} from "lucide-react";
import { cn } from "../../_lib/utils/cn";

export interface BulkActionItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void | Promise<void>;
  variant?: "default" | "destructive" | "secondary";
  disabled?: boolean;
}

export interface StatusOption {
  label: string;
  value: string;
  color?: string;
}

export interface BulkActionBarProps {
  selectedCount: number;
  onClear: () => void;
  entityName?: string; // e.g. "xona", "bron"
  onConfirmAll?: () => void | Promise<void>;
  onCancelAll?: () => void | Promise<void>;
  onChangeStatus?: (status: string) => void | Promise<void>;
  statusOptions?: StatusOption[];
  actions?: BulkActionItem[];
  className?: string;
  isProcessing?: boolean;
}

/**
 * Ekranning pastki markazida suzuvchi (floating pill panel) guruhli amallar paneli.
 * Linear/Apple uslubidagi qora shaffof qatlam (`backdrop-blur-xl`), 60fps animatsiya
 * va a11y (WCAG touch targets, keyboard escape) bilan ta'minlangan.
 */
export function BulkActionBar({
  selectedCount,
  onClear,
  entityName = "ta tanlandi",
  onConfirmAll,
  onCancelAll,
  onChangeStatus,
  statusOptions,
  actions = [],
  className,
  isProcessing = false,
}: BulkActionBarProps) {
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Esc bosilganda tanlovni tozalash
  useEffect(() => {
    if (selectedCount === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showStatusMenu) {
          setShowStatusMenu(false);
        } else {
          onClear();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedCount, onClear, showStatusMenu]);

  if (selectedCount === 0) {
    return null;
  }

  const handleAction = async (key: string, fn?: () => void | Promise<void>) => {
    if (!fn || isProcessing) return;
    try {
      setLoadingAction(key);
      await fn();
    } finally {
      setLoadingAction(null);
    }
  };

  const handleStatusSelect = async (statusVal: string) => {
    setShowStatusMenu(false);
    if (!onChangeStatus) return;
    try {
      setLoadingAction("status");
      await onChangeStatus(statusVal);
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div
      role="region"
      aria-label="Guruhli amallar paneli"
      aria-live="polite"
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "animate-in fade-in slide-in-from-bottom-5 duration-200",
        className,
      )}
    >
      <div
        className={cn(
          "relative flex items-center flex-wrap gap-2 sm:gap-3 px-4 py-2.5 sm:px-5 sm:py-3 rounded-2xl",
          "bg-slate-900/92 dark:bg-zinc-900/92 backdrop-blur-xl text-white",
          "border border-slate-700/60 dark:border-zinc-700/60 shadow-2xl shadow-black/40",
          "max-w-[calc(100vw-2rem)]",
        )}
      >
        {/* Count indicator */}
        <div className="flex items-center gap-2 pr-2 border-r border-slate-700/60 dark:border-zinc-700/60">
          <span className="flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full bg-brand-500 text-white font-bold text-xs shadow-sm">
            {selectedCount}
          </span>
          <span className="text-xs sm:text-sm font-medium text-slate-200 hidden sm:inline whitespace-nowrap">
            {entityName}
          </span>
        </div>

        {/* Action: Ommaviy tasdiqlash */}
        {onConfirmAll && (
          <button
            type="button"
            disabled={isProcessing || loadingAction !== null}
            onClick={() => handleAction("confirm", onConfirmAll)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all min-h-[38px]",
              "bg-emerald-600/90 hover:bg-emerald-600 text-white shadow-sm hover:shadow",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400",
              "disabled:opacity-50 disabled:pointer-events-none",
            )}
          >
            {loadingAction === "confirm" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-200" />
            )}
            <span>Ommaviy tasdiqlash</span>
          </button>
        )}

        {/* Action: Holatini o'zgartirish */}
        {onChangeStatus && (
          <div className="relative">
            <button
              type="button"
              disabled={isProcessing || loadingAction !== null}
              onClick={() => setShowStatusMenu((prev) => !prev)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all min-h-[38px]",
                "bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700/80",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
                "disabled:opacity-50 disabled:pointer-events-none",
                showStatusMenu && "bg-slate-700 ring-2 ring-brand-400",
              )}
            >
              {loadingAction === "status" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <SlidersHorizontal className="h-4 w-4 text-slate-300" />
              )}
              <span>Holatini o'zgartirish</span>
            </button>

            {/* Status Dropdown Menu */}
            {showStatusMenu && statusOptions && statusOptions.length > 0 && (
              <div
                role="menu"
                className={cn(
                  "absolute bottom-full mb-2 left-0 min-w-[200px] p-1.5 rounded-xl shadow-2xl",
                  "bg-slate-900/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-700/80 dark:border-zinc-700/80",
                  "flex flex-col gap-1 z-50",
                  "animate-in fade-in slide-in-from-bottom-2 duration-150",
                )}
              >
                <div className="px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1 mb-1">
                  Yangi holatni tanlang
                </div>
                {statusOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="menuitem"
                    onClick={() => handleStatusSelect(opt.value)}
                    className="flex items-center justify-between px-3 py-2 text-xs font-medium rounded-lg text-slate-200 hover:text-white hover:bg-white/10 transition-colors text-left min-h-[36px]"
                  >
                    <span>{opt.label}</span>
                    {opt.color && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ backgroundColor: opt.color }}
                      />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Custom Actions */}
        {actions.map((act, idx) => (
          <button
            key={idx}
            type="button"
            disabled={isProcessing || act.disabled || loadingAction !== null}
            onClick={() => handleAction(`act-${idx}`, act.onClick)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all min-h-[38px]",
              act.variant === "destructive"
                ? "bg-red-600/90 hover:bg-red-600 text-white"
                : act.variant === "secondary"
                  ? "bg-slate-800 hover:bg-slate-700 text-slate-100"
                  : "bg-brand-600/90 hover:bg-brand-600 text-white",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400",
              "disabled:opacity-50 disabled:pointer-events-none",
            )}
          >
            {loadingAction === `act-${idx}` ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              act.icon
            )}
            <span>{act.label}</span>
          </button>
        ))}

        {/* Action: Bekor qilish */}
        {onCancelAll && (
          <button
            type="button"
            disabled={isProcessing || loadingAction !== null}
            onClick={() => handleAction("cancel", onCancelAll)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition-all min-h-[38px]",
              "bg-red-600/20 hover:bg-red-600 text-red-200 hover:text-white border border-red-500/30",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400",
              "disabled:opacity-50 disabled:pointer-events-none",
            )}
          >
            {loadingAction === "cancel" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <XCircle className="h-4 w-4 text-red-300" />
            )}
            <span>Bekor qilish</span>
          </button>
        )}

        {/* Action: Tanlovni tozalash */}
        <button
          type="button"
          onClick={onClear}
          title="Tanlovni tozalash (Esc)"
          className="flex items-center gap-1 p-1.5 sm:px-2 sm:py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-white/10 transition-colors ml-1 min-h-[38px]"
        >
          <X className="h-4 w-4" />
          <span className="hidden md:inline">Tozalash</span>
        </button>
      </div>
    </div>
  );
}
