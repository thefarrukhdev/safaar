"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useOnClickOutside } from "@/hooks/use-on-click-outside";
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

function addDays(d: Date, days: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + days);
  return result;
}

const UZ_MONTHS = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentyabr", "Oktyabr", "Noyabr", "Dekabr",
];

const UZ_MONTHS_SHORT = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyn",
  "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek",
];

const UZ_WEEKDAYS = ["Dush", "Sesh", "Chor", "Pay", "Juma", "Shan", "Yak"];

const INTL_LOCALE: Record<string, string> = {
  uz: "ru-RU",
  ru: "ru-RU",
  en: "en-US",
};

interface DateRangePickerProps {
  locale: Locale;
  checkInLabel: string;
  checkOutLabel: string;
  checkIn: string;
  checkOut: string;
  onCheckInChange: (iso: string) => void;
  onCheckOutChange: (iso: string) => void;
  min?: string;
  checkInPlaceholder?: string;
  checkOutPlaceholder?: string;
  className?: string;
}

export function DateRangePicker({
  locale,
  checkInLabel,
  checkOutLabel,
  checkIn,
  checkOut,
  onCheckInChange,
  onCheckOutChange,
  min,
  checkInPlaceholder = "Sana tanlang",
  checkOutPlaceholder = "Sana tanlang",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"checkIn" | "checkOut">("checkIn");
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const [highlight, setHighlight] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
  }>({ x: 0, y: 0, width: 0, height: 0, visible: false });

  const selectedCheckIn = parseISO(checkIn);
  const selectedCheckOut = parseISO(checkOut);
  const baseMinDate = min ? parseISO(min) : null;

  // Kalendar view sanasi - active stepga qarab
  const [view, setView] = useState<Date>(
    () => selectedCheckIn ?? baseMinDate ?? new Date()
  );

  // Active step o'zgarganda viewni ham o'zgartirish
  useEffect(() => {
    if (open) {
      const parsedCheckIn = parseISO(checkIn);
      const parsedCheckOut = parseISO(checkOut);
      if (step === "checkIn" && parsedCheckIn) {
        setView(new Date(parsedCheckIn));
      } else if (step === "checkOut" && parsedCheckOut) {
        setView(new Date(parsedCheckOut));
      } else if (step === "checkOut" && parsedCheckIn) {
        setView(new Date(parsedCheckIn));
      }
    }
  }, [step, open, checkIn, checkOut]);

  useOnClickOutside(ref, () => {
    if (open) {
      setOpen(false);
      setHighlight((prev) => ({ ...prev, visible: false }));
    }
  });

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setHighlight((prev) => ({ ...prev, visible: false }));
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
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
      fmt.format(new Date(base.getFullYear(), base.getMonth(), base.getDate() + i))
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

  const formatDisplay = (val: string | null) => {
    const d = parseISO(val || "");
    if (!d) return null;
    if (locale === "uz") {
      return `${d.getDate()}-${UZ_MONTHS_SHORT[d.getMonth()]}. ${d.getFullYear()} y.`;
    }
    return new Intl.DateTimeFormat(intlLocale, {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(d);
  };

  const checkInDisplay = formatDisplay(checkIn);
  const checkOutDisplay = formatDisplay(checkOut);

  const todayISO = toISO(startOfDay(new Date()));

  function isDisabled(d: Date): boolean {
    const targetDate = startOfDay(d);
    if (step === "checkIn") {
      if (!baseMinDate) return false;
      return targetDate < startOfDay(baseMinDate);
    } else {
      const minOut = selectedCheckIn ? addDays(selectedCheckIn, 1) : (baseMinDate || new Date());
      return targetDate < startOfDay(minOut);
    }
  }

  const handleDayClick = (iso: string) => {
    if (step === "checkIn") {
      onCheckInChange(iso);
      if (checkOut && iso >= checkOut) {
        onCheckOutChange("");
      }
      setStep("checkOut");
    } else {
      onCheckOutChange(iso);
      setOpen(false);
      setHighlight((prev) => ({ ...prev, visible: false }));
    }
  };

  const toggleOpen = (newStep: "checkIn" | "checkOut") => {
    if (!open) {
      setStep(newStep);
      setOpen(true);
    } else {
      if (step === newStep) {
        setOpen(false);
        setHighlight((prev) => ({ ...prev, visible: false }));
      } else {
        setStep(newStep);
      }
    }
  };

  const handleDayHover = (el: HTMLElement) => {
    setHighlight({
      x: el.offsetLeft,
      y: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
      visible: true,
    });
  };

  return (
    <div ref={ref} className={`relative flex-1 ${className ?? ""}`}>
      <div className="relative flex w-full items-center rounded-xl border border-slate-200 bg-white shadow-xs transition-all hover:border-slate-300 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-600">
        {/* Kirish qismi */}
        <button
          type="button"
          onClick={() => toggleOpen("checkIn")}
          className={`group relative flex flex-1 items-center gap-3 px-3.5 py-2.5 text-left rounded-l-xl cursor-pointer transition-all active:scale-[0.98] focus-visible:outline-none`}
        >
          {open && step === "checkIn" && (
            <motion.div
              layoutId="date-range-active-step"
              transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.7 }}
              className="absolute inset-0 rounded-l-xl bg-blue-50/60 pointer-events-none"
            />
          )}
          <span className={`relative z-10 shrink-0 transition-colors ${open && step === "checkIn" ? "text-blue-600" : "text-slate-500 group-hover:text-blue-600"}`}>
            <CalendarIcon className="h-4 w-4" />
          </span>
          <span className="relative z-10 flex min-w-0 flex-1 flex-col">
            <span className={`text-[11px] font-bold ${open && step === "checkIn" ? "text-blue-600" : "text-slate-500"}`}>
              {checkInLabel}
            </span>
            <span className={`truncate text-xs font-bold ${checkInDisplay ? "text-slate-900" : "text-slate-400"}`}>
              {checkInDisplay ?? checkInPlaceholder}
            </span>
          </span>
        </button>

        <div className="w-px h-10 bg-slate-200 shrink-0" />

        {/* Chiqish qismi */}
        <button
          type="button"
          onClick={() => toggleOpen("checkOut")}
          className={`group relative flex flex-1 items-center gap-3 px-3.5 py-2.5 text-left rounded-r-xl cursor-pointer transition-all active:scale-[0.98] focus-visible:outline-none`}
        >
          {open && step === "checkOut" && (
            <motion.div
              layoutId="date-range-active-step"
              transition={{ type: "spring", stiffness: 500, damping: 35, mass: 0.7 }}
              className="absolute inset-0 rounded-r-xl bg-blue-50/60 pointer-events-none"
            />
          )}
          <span className={`relative z-10 shrink-0 transition-colors ${open && step === "checkOut" ? "text-blue-600" : "text-slate-500 group-hover:text-blue-600"}`}>
            <CalendarIcon className="h-4 w-4" />
          </span>
          <span className="relative z-10 flex min-w-0 flex-1 flex-col">
            <span className={`text-[11px] font-bold ${open && step === "checkOut" ? "text-blue-600" : "text-slate-500"}`}>
              {checkOutLabel}
            </span>
            <span className={`truncate text-xs font-bold ${checkOutDisplay ? "text-slate-900" : "text-slate-400"}`}>
              {checkOutDisplay ?? checkOutPlaceholder}
            </span>
          </span>
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="fixed inset-0 z-40 bg-black/40 md:hidden"
              aria-hidden="true"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
              animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl md:absolute md:inset-auto md:left-0 md:top-full md:z-50 md:mt-2 md:w-80 md:translate-y-0"
            >
              {/* Step Indicator */}
              <div className="mb-3 text-center md:text-left text-xs font-bold text-blue-600 pb-2 border-b border-slate-100">
                {step === "checkIn" ? `1-qadam: ${checkInLabel}` : `2-qadam: ${checkOutLabel}`}
              </div>

              {/* Mobile Header with Close Button */}
              <div className="flex items-center justify-between mb-3 md:hidden absolute right-4 top-4">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                  aria-label="Yopish"
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
                  aria-label="Oldingi oy"
                  className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition-all duration-150 hover:bg-slate-100 hover:text-blue-600 active:scale-[0.92]"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-black uppercase tracking-wider text-slate-900">
                  {monthLabel}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))
                  }
                  aria-label="Keyingi oy"
                  className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition-all duration-150 hover:bg-slate-100 hover:text-blue-600 active:scale-[0.92]"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Hafta kunlari */}
              <div className="mb-1 grid grid-cols-7 gap-1">
                {weekdays.map((w) => (
                  <span
                    key={w}
                    className="grid h-8 place-items-center text-[10px] font-black uppercase text-slate-400 select-none"
                  >
                    {w}
                  </span>
                ))}
              </div>

              {/* Kunlar (Fluid Highlight Pill bilan) */}
              <div
                onMouseLeave={() => setHighlight((prev) => ({ ...prev, visible: false }))}
                className="relative grid grid-cols-7 gap-1"
              >
                {/* Fluid Floating Highlight Pill on Hover */}
                {!prefersReducedMotion && (
                  <motion.div
                    aria-hidden="true"
                    initial={false}
                    animate={{
                      x: highlight.x,
                      y: highlight.y,
                      width: highlight.width,
                      height: highlight.height,
                      opacity: highlight.visible ? 1 : 0,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 550,
                      damping: 38,
                      mass: 0.6,
                      opacity: { duration: 0.12 },
                    }}
                    className="pointer-events-none absolute left-0 top-0 rounded-full bg-blue-50/80"
                  />
                )}

                {days.map((d, i) => {
                  if (!d) return <span key={`empty-${i}`} className="h-8 w-8" />;
                  const iso = toISO(d);

                  let isSelected = false;
                  let isRange = false;

                  if (checkIn && iso === checkIn) isSelected = true;
                  if (checkOut && iso === checkOut) isSelected = true;

                  if (checkIn && checkOut && iso > checkIn && iso < checkOut) {
                    isRange = true;
                  }

                  const isToday = iso === todayISO;
                  const disabled = isDisabled(d);

                  return (
                    <button
                      key={iso}
                      type="button"
                      disabled={disabled}
                      onMouseEnter={(e) => !disabled && handleDayHover(e.currentTarget)}
                      onClick={() => handleDayClick(iso)}
                      className={`relative z-10 grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-all duration-150 select-none active:scale-[0.92] ${
                        isSelected
                          ? "bg-blue-600 text-white shadow-sm shadow-blue-500/30 font-bold"
                          : isRange
                          ? "bg-blue-50 text-blue-700 font-semibold"
                          : disabled
                          ? "cursor-not-allowed text-slate-300"
                          : "text-slate-800 hover:text-blue-700"
                      } ${!isSelected && !isRange && isToday ? "ring-1 ring-blue-400" : ""}`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default DateRangePicker;
