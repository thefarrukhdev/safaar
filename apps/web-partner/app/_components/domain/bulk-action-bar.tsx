"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  XCircle,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { cn } from "../../_lib/utils/cn";
import { Button } from "../ui/button";

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
  const statusMenuRef = useRef<HTMLDivElement>(null);

  // Tashqariga bosilganda status menyuni yopish
  useEffect(() => {
    if (!showStatusMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        statusMenuRef.current &&
        !statusMenuRef.current.contains(e.target as Node)
      ) {
        setShowStatusMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showStatusMenu]);

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
          <Button
            type="button"
            size="sm"
            variant="primary"
            disabled={isProcessing}
            loading={loadingAction === "confirm"}
            onClick={() => handleAction("confirm", onConfirmAll)}
            className="bg-emerald-600 hover:bg-emerald-500 border-emerald-500 text-white min-h-[38px]"
          >
            <CheckCircle2 className="h-4 w-4 text-emerald-200 mr-1.5" />
            <span>Ommaviy tasdiqlash</span>
          </Button>
        )}

        {/* Action: Holatini o'zgartirish */}
        {onChangeStatus && (
          <div ref={statusMenuRef} className="relative">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              disabled={isProcessing}
              loading={loadingAction === "status"}
              onClick={() => setShowStatusMenu((prev) => !prev)}
              className={cn(
                "bg-slate-800 hover:bg-slate-700 text-slate-100 border-slate-700/80 min-h-[38px]",
                showStatusMenu && "bg-slate-700 ring-2 ring-brand-400",
              )}
            >
              <SlidersHorizontal className="h-4 w-4 text-slate-300 mr-1.5" />
              <span>Holatini o'zgartirish</span>
            </Button>

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
          <Button
            key={idx}
            type="button"
            size="sm"
            variant={
              act.variant === "destructive"
                ? "danger"
                : act.variant === "secondary"
                  ? "secondary"
                  : "primary"
            }
            disabled={isProcessing || act.disabled}
            loading={loadingAction === `act-${idx}`}
            onClick={() => handleAction(`act-${idx}`, act.onClick)}
            className="min-h-[38px]"
          >
            {act.icon}
            <span>{act.label}</span>
          </Button>
        ))}

        {/* Action: Bekor qilish */}
        {onCancelAll && (
          <Button
            type="button"
            size="sm"
            variant="danger"
            disabled={isProcessing}
            loading={loadingAction === "cancel"}
            onClick={() => handleAction("cancel", onCancelAll)}
            className="min-h-[38px]"
          >
            <XCircle className="h-4 w-4 text-rose-200 mr-1.5" />
            <span>Bekor qilish</span>
          </Button>
        )}

        {/* Action: Tanlovni tozalash */}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClear}
          title="Tanlovni tozalash (Esc)"
          className="text-slate-400 hover:text-white hover:bg-white/10 min-h-[38px] p-1.5 sm:px-2"
        >
          <X className="h-4 w-4 mr-1" />
          <span className="hidden md:inline">Tozalash</span>
        </Button>
      </div>
    </div>
  );
}
