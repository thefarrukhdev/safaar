"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, Clock, ChevronDown, X } from "lucide-react";
import { cn } from "../../_lib/utils/cn";

export interface TimePickerProps {
  id?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  presets?: string[];
  presetsLabel?: string;
  disabled?: boolean;
  className?: string;
  error?: boolean;
}

/** 12-soatlik (AM/PM) yoki noto'g'ri formatdagi vaqtni toza 24-soatlik "HH:mm" ga normalizatsiya qilish */
export function normalizeTimeValue(raw?: string): string {
  if (!raw) return "";
  const str = String(raw).trim();
  if (!str) return "";

  // 12-hour AM/PM format: e.g. "01:00 PM", "1:30 am", "11:00PM"
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (ampmMatch) {
    let hours = parseInt(ampmMatch[1], 10);
    const minutes = ampmMatch[2];
    const isPm = ampmMatch[3].toLowerCase() === "pm";
    if (isPm && hours < 12) hours += 12;
    if (!isPm && hours === 12) hours = 0;
    return `${hours.toString().padStart(2, "0")}:${minutes}`;
  }

  // 24-hour format: "HH:mm" or "HH:mm:ss"
  const timeMatch = str.match(/^(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = Math.min(23, Math.max(0, parseInt(timeMatch[1], 10)));
    const minutes = Math.min(59, Math.max(0, parseInt(timeMatch[2], 10)));
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
  }

  return "";
}

const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, "0"));
const MINUTES = ["00", "15", "30", "45"];

export function TimePicker({
  id,
  value,
  defaultValue,
  onChange,
  placeholder = "Vaqtni tanlang",
  presets = [],
  presetsLabel = "Tezkor",
  disabled = false,
  className,
  error = false,
}: TimePickerProps) {
  const generatedId = useId();
  const inputId = id || generatedId;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Qiymat
  const normalizedValue = useMemo(() => normalizeTimeValue(value ?? defaultValue), [value, defaultValue]);

  const [selectedHour, selectedMinute] = useMemo(() => {
    if (!normalizedValue || !normalizedValue.includes(":")) {
      return ["", ""];
    }
    const [h, m] = normalizedValue.split(":");
    return [h, m];
  }, [normalizedValue]);

  // Tashqariga bosilganda yopish
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelectTime = (h: string, m: string) => {
    const finalH = h || selectedHour || "12";
    const finalM = m || selectedMinute || "00";
    const formatted = `${finalH}:${finalM}`;
    onChange?.(formatted);
  };

  const handleHourClick = (h: string) => {
    const m = selectedMinute || "00";
    handleSelectTime(h, m);
  };

  const handleMinuteClick = (m: string) => {
    const h = selectedHour || "10";
    handleSelectTime(h, m);
  };

  const handlePresetClick = (preset: string) => {
    const normalized = normalizeTimeValue(preset);
    if (normalized) {
      onChange?.(normalized);
      setIsOpen(false);
    }
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange?.("");
  };

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5 w-full">
      {/* Trigger Button */}
      <div
        id={inputId}
        role="button"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (!disabled && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={cn(
          "group flex h-10 w-full items-center justify-between rounded-lg border bg-[var(--surface)] px-3 py-2 text-sm transition-all cursor-pointer select-none",
          "hover:border-brand-500 hover:bg-[var(--surface-hover)]/40",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/25 focus-visible:border-brand-500",
          isOpen
            ? "border-brand-500 ring-2 ring-brand-500/20"
            : error
              ? "border-red-500 ring-red-500/20"
              : "border-[var(--border)]",
          disabled && "cursor-not-allowed opacity-60 hover:border-[var(--border)] hover:bg-[var(--surface)]",
          className,
        )}
      >
        <div className="flex items-center gap-2.5 truncate">
          <Clock
            className={cn(
              "h-4 w-4 shrink-0 transition-colors",
              normalizedValue
                ? "text-brand-600 dark:text-brand-400"
                : "text-[var(--muted-foreground)] group-hover:text-brand-600",
            )}
          />
          {normalizedValue ? (
            <span className="font-semibold text-sm tracking-wide text-[var(--foreground)]">
              {normalizedValue}
            </span>
          ) : (
            <span className="text-[var(--muted-foreground)] text-xs sm:text-sm">
              {placeholder}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 ml-2">
          {normalizedValue && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-md text-[var(--muted-foreground)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors cursor-pointer"
              title="Vaqtni tozalash"
              aria-label="Vaqtni tozalash"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-[var(--muted-foreground)] transition-transform duration-200 shrink-0",
              isOpen && "rotate-180 text-brand-600",
            )}
          />
        </div>
      </div>

      {/* Tezkor tanlov chiplari (Quick Presets) */}
      {presets.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
          <span className="text-[11px] font-medium text-[var(--muted-foreground)] mr-0.5">
            {presetsLabel}:
          </span>
          {presets.map((preset) => {
            const normalizedPreset = normalizeTimeValue(preset);
            const isSelected = normalizedValue === normalizedPreset;
            return (
              <button
                key={preset}
                type="button"
                disabled={disabled}
                onClick={() => handlePresetClick(preset)}
                className={cn(
                  "px-2.5 py-0.5 text-xs rounded-md transition-all font-medium cursor-pointer border select-none",
                  isSelected
                    ? "bg-brand-600 border-brand-600 text-white shadow-xs font-semibold"
                    : "bg-[var(--surface)] border-[var(--border)] text-[var(--foreground)] hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300",
                )}
              >
                {normalizedPreset}
              </button>
            );
          })}
        </div>
      )}

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Vaqtni tanlash oynasi"
          className={cn(
            "absolute top-full left-0 z-50 mt-1.5 w-full min-w-[280px] max-w-[340px] rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-2xl backdrop-blur-xl animate-in fade-in-0 zoom-in-95",
            "dark:bg-zinc-900/98 dark:border-zinc-800",
          )}
        >
          {/* Popover Header */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--border)]">
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-[var(--foreground)]">
                Vaqtni tanlang
              </span>
              <span className="text-[11px] text-[var(--muted-foreground)]">
                24 soatlik format (HH:mm)
              </span>
            </div>
            {normalizedValue && (
              <div className="flex items-center gap-1 bg-brand-50 dark:bg-brand-950/40 border border-brand-200 dark:border-brand-800 text-brand-700 dark:text-brand-300 px-2 py-0.5 rounded-md font-mono text-xs font-semibold">
                <Clock className="h-3 w-3" />
                {normalizedValue}
              </div>
            )}
          </div>

          {/* Tanlov ustunlari (Soat va Daqiqa) */}
          <div className="grid grid-cols-2 gap-3">
            {/* 1-ustun: Soat (00..23) */}
            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] px-1">
                Soat
              </div>
              <div className="grid grid-cols-3 gap-1 max-h-48 overflow-y-auto pr-1 scrollbar-thin">
                {HOURS.map((h) => {
                  const isSelected = selectedHour === h;
                  return (
                    <button
                      key={h}
                      type="button"
                      onClick={() => handleHourClick(h)}
                      className={cn(
                        "h-8 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center justify-center",
                        isSelected
                          ? "bg-brand-600 text-white font-semibold shadow-xs"
                          : "text-[var(--foreground)] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--border)]",
                      )}
                    >
                      {h}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2-ustun: Daqiqa (00, 15, 30, 45) */}
            <div className="flex flex-col gap-1.5">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] px-1">
                Daqiqa
              </div>
              <div className="flex flex-col gap-1">
                {MINUTES.map((m) => {
                  const isSelected = selectedMinute === m;
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => handleMinuteClick(m)}
                      className={cn(
                        "h-9 px-3 rounded-md text-xs font-medium transition-all cursor-pointer flex items-center justify-between",
                        isSelected
                          ? "bg-brand-600 text-white font-semibold shadow-xs"
                          : "text-[var(--foreground)] hover:bg-[var(--surface-hover)] border border-transparent hover:border-[var(--border)]",
                      )}
                    >
                      <span>:{m}</span>
                      {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-3.5 pt-2.5 border-t border-[var(--border)] flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-brand-600 text-white hover:bg-brand-700 transition-colors shadow-xs cursor-pointer"
            >
              Tayyor
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
