"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import type { Locale } from "@/i18n/config";

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseISO(s: string): Date | null {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** O'zbek tilida oy nomlari (Intl "uz" locale'ni to'g'ri ko'rsatmaganligi sababli). */
const UZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];

const UZ_MONTHS_SHORT = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyn",
  "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek",
];

const UZ_WEEKDAYS = ["Dush", "Sesh", "Chor", "Pay", "Juma", "Shan", "Yak"];

/** Locale → BCP-47 xarita (Intl uchun). */
const INTL_LOCALE: Record<string, string> = {
  uz: "ru-RU", // Intl default fallback for 'uz' is sometimes buggy on older browsers/Node, but we override manually below
  ru: "ru-RU",
  en: "en-US",
};

/**
 * Global Custom DatePicker Component for Safaar Design System.
 * Supports light/dark mode, customizable icons, min date constraints, and locale formatting.
 */
export function DatePicker({
  locale = "uz",
  label,
  value,
  onChange,
  min,
  icon,
  compact,
  placeholder = "Sana tanlang",
  className,
}: {
  locale?: Locale;
  label?: string;
  value: string;
  onChange: (iso: string) => void;
  min?: string;
  icon?: React.ReactNode;
  compact?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = parseISO(value);
  const minDate = min ? parseISO(min) : null;

  const [view, setView] = useState<Date>(
    () => selected ?? minDate ?? new Date(),
  );

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const intlLocale = INTL_LOCALE[locale] ?? "en-US";

  const monthLabel = useMemo(() => {
    if (locale === "uz") {
      return `${UZ_MONTHS[view.getMonth()]} ${view.getFullYear()}`;
    }
    return new Intl.DateTimeFormat(intlLocale, {
      month: "long",
      year: "numeric",
    }).format(view);
  }, [locale, intlLocale, view]);

  const weekdays = useMemo(() => {
    if (locale === "uz") {
      return UZ_WEEKDAYS;
    }
    const fmt = new Intl.DateTimeFormat(intlLocale, { weekday: "short" });
    const base = new Date(2024, 0, 1);
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)),
    );
  }, [locale, intlLocale]);

  const days = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [view]);

  const displayValue = useMemo(() => {
    if (!selected) return null;
    if (locale === "uz") {
      return `${selected.getDate()}-${UZ_MONTHS_SHORT[selected.getMonth()]}. ${selected.getFullYear()} y.`;
    }
    return new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(selected);
  }, [selected, locale, intlLocale]);

  const todayISO = toISO(startOfDay(new Date()));

  function isDisabled(d: Date): boolean {
    if (!minDate) return false;
    return startOfDay(d) < startOfDay(minDate);
  }

  return (
    <div ref={ref} className={`relative flex-1 ${className ?? ""}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          compact
            ? "flex w-full items-center gap-2 text-left"
            : "group flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-card px-3.5 py-2.5 text-left transition-all hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500   "
        }
      >
        {!compact && (
          <span className="shrink-0 text-slate-500 transition-colors group-hover:text-primary-600  :text-primary-400">
            {icon ?? <CalendarIcon className="h-4 w-4" />}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          {label && (
            <span className="text-[11px] font-bold text-slate-500 ">{label}</span>
          )}
          <span
            className={`truncate text-xs font-bold ${
              displayValue ? "text-slate-900 " : "text-slate-400 "
            }`}
          >
            {displayValue ?? placeholder}
          </span>
        </span>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-xs md:hidden" aria-hidden />
          <div className="fixed inset-x-4 top-1/2 z-100 -translate-y-1/2 rounded-xl border border-slate-200 bg-card p-4 shadow-2xl   md:absolute md:inset-auto md:left-0 md:top-full md:z-100 md:mt-2 md:w-72 md:translate-y-0 animate-in fade-in zoom-in-95 duration-100">
            {/* Mobile Header with Close Button */}
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100  md:hidden">
              <span className="text-xs font-bold text-slate-800 ">{placeholder}</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600  :text-slate-300 p-1 rounded-full hover:bg-slate-100 :bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Oy navigatsiyasi */}
            <div className="mb-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() =>
                  setView((v) => new Date(v.getFullYear(), v.getMonth() - 1, 1))
                }
                aria-label="prev"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary-600  :bg-slate-800 :text-primary-400"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 ">
                {monthLabel}
              </span>
              <button
                type="button"
                onClick={() =>
                  setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))
                }
                aria-label="next"
                className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary-600  :bg-slate-800 :text-primary-400"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Hafta kunlari */}
            <div className="mb-1 grid grid-cols-7 gap-1">
              {weekdays.map((w) => (
                <span
                  key={w}
                  className="grid h-8 place-items-center text-[10px] font-black uppercase text-slate-400 "
                >
                  {w}
                </span>
              ))}
            </div>

            {/* Kunlar */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((d, i) => {
                if (!d) return <span key={`e${i}`} />;
                const iso = toISO(d);
                const isSelected = iso === value;
                const isToday = iso === todayISO;
                const disabled = isDisabled(d);

                return (
                  <button
                    key={iso}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      onChange(iso);
                      setOpen(false);
                    }}
                    className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-all duration-150 active:scale-90
                      ${
                        isSelected
                          ? "bg-primary-600 text-white shadow-xs"
                          : disabled
                            ? "cursor-not-allowed text-slate-300 "
                            : "text-slate-800 hover:bg-primary-50 hover:text-primary-700  :bg-slate-800 :text-primary-400"
                      }
                      ${!isSelected && isToday ? "ring-1 ring-primary-400" : ""}
                    `}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
