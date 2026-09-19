"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Locale } from "@/i18n/config";

/** Sanani YYYY-MM-DD ga aylantirish (timezone'siz, lokal). */
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

/** Locale → BCP-47 xarita (Intl uchun). */
const INTL_LOCALE: Record<string, string> = {
  uz: "ru-RU",
  ru: "ru-RU",
  en: "en-US",
};

/**
 * Custom kalendar — bizning yashil uslubda.
 * Native date input o'rniga: tugma + ochiluvchi oy kalendari.
 */
export function DatePicker({
  locale,
  label,
  value,
  onChange,
  min,
  icon,
  compact,
  placeholder,
}: {
  locale: Locale;
  label: string;
  value: string;
  onChange: (iso: string) => void;
  /** Eng erta tanlanadigan sana (ISO). */
  min?: string;
  icon: React.ReactNode;
  /** Compact rejim: wrapper border/shadow yo'q, mobil karta ichida ishlatish uchun. */
  compact?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const selected = parseISO(value);
  const minDate = min ? parseISO(min) : null;

  // Ko'rsatilayotgan oy
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

  // Oy nomi va hafta kunlari (tilga moslangan)
  // "uz" locale Intl'da to'liq qo'llab-quvvatlanmaydi → UZ_MONTHS hardcoded.
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
    const fmt = new Intl.DateTimeFormat(intlLocale, { weekday: "short" });
    // Dushanba boshlanishi (1..7)
    const base = new Date(2024, 0, 1); // 2024-01-01 = Dushanba
    return Array.from({ length: 7 }, (_, i) =>
      fmt.format(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i)),
    );
  }, [intlLocale]);

  // Oyning kunlari grid (dushanbadan)
  const days = useMemo(() => {
    const year = view.getFullYear();
    const month = view.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 6) % 7; // Dushanba = 0
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
    return cells;
  }, [view]);

  const displayValue = selected
    ? new Intl.DateTimeFormat(intlLocale, {
        day: "numeric",
        month: "short",
      }).format(selected)
    : null;

  const todayISO = toISO(startOfDay(new Date()));

  function isDisabled(d: Date): boolean {
    if (!minDate) return false;
    return startOfDay(d) < startOfDay(minDate);
  }

  return (
    <div ref={ref} className="flex-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          compact
            ? "flex w-full items-center gap-2 text-left before:absolute before:inset-0 before:z-10"
            : "group flex w-full items-center gap-3 rounded-lg border border-slate-300 bg-card px-4 py-3 text-left transition-colors hover:border-slate-400 before:absolute before:inset-0 before:z-10"
        }
        style={undefined}
      >
        {!compact && (
          <span className="shrink-0 text-slate-700 transition-colors group-hover:text-primary-600">
            {icon}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          {!compact && (
            <span className="text-xs font-medium text-slate-600">{label}</span>
          )}
          <span
            className={`truncate text-base font-bold ${
              displayValue ? "text-slate-900" : "text-slate-600"
            }`}
          >
            {displayValue ?? placeholder ?? "—"}
          </span>
        </span>
      </button>

      {open && (
        <>
          {/* Mobilda overlay */}
          <div className="fixed inset-0 z-40 bg-slate-900/60 backdrop-blur-xs md:hidden" aria-hidden onClick={() => setOpen(false)} />
          <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-xl border border-slate-200 bg-card p-4 shadow-2xl dark:border-slate-800 dark:bg-slate-900 md:absolute md:inset-auto md:left-0 md:top-full md:mt-2 md:w-72 md:translate-y-0">
            {/* Mobile Header with Close Button */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-slate-800 md:hidden">
              <span className="text-sm font-bold text-slate-800 dark:text-white">Sanani tanlang</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
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
              className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary-600 active:scale-90"
            >
              <ChevronLeft />
            </button>
            <span className="text-sm font-semibold capitalize text-slate-900">
              {monthLabel}
            </span>
            <button
              type="button"
              onClick={() =>
                setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))
              }
              aria-label="next"
              className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-primary-600 active:scale-90"
            >
              <ChevronRight />
            </button>
          </div>

          {/* Hafta kunlari */}
          <div className="mb-1 grid grid-cols-7 gap-1">
            {weekdays.map((w) => (
              <span
                key={w}
                className="grid h-8 place-items-center text-[11px] font-medium uppercase text-slate-400"
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
                  className={`grid h-9 w-9 place-items-center rounded-full text-sm font-medium transition-all duration-150 active:scale-90
                    ${
                      isSelected
                        ? "bg-primary-600 text-white shadow-sm"
                        : disabled
                          ? "cursor-not-allowed text-slate-300"
                          : "text-slate-700 hover:bg-primary-50 hover:text-primary-700"
                    }
                    ${!isSelected && isToday ? "ring-1 ring-primary-300" : ""}
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

function ChevronLeft() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="m15 6-6 6 6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4" aria-hidden>
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
