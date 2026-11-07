"use client";

import { useState, useRef, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { uz, ru, enUS } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { DayPicker, DateRange } from "react-day-picker";
import { motion, AnimatePresence } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "@/lib/search-params";
import "react-day-picker/dist/style.css"; // Default styles for quick setup

const locales: Record<string, any> = { uz, ru, en: enUS };

export function SearchDatePicker({
  locale = "uz",
  dict,
}: {
  locale?: string;
  dict?: { selectDate?: string; checkInCheckOut?: string };
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  // 1. Nuqs orqali URL bilan bog'lanish
  const [dates, setDates] = useQueryStates(
    {
      checkIn: searchParamsParsers.checkIn,
      checkOut: searchParamsParsers.checkOut,
    },
    { shallow: false } // Trigger server fetch only when fully selected
  );

  // 2. Internal state for the calendar so it doesn't trigger URL/server update on first click
  const [internalRange, setInternalRange] = useState<DateRange | undefined>({
    from: dates.checkIn ? parseISO(dates.checkIn) : undefined,
    to: dates.checkOut ? parseISO(dates.checkOut) : undefined,
  });

  // Tashqaridan (URL'dan) kelgan o'zgarishlarni internal state'ga sinxronlash
  useEffect(() => {
    if (!open) {
      setInternalRange({
        from: dates.checkIn ? parseISO(dates.checkIn) : undefined,
        to: dates.checkOut ? parseISO(dates.checkOut) : undefined,
      });
    }
  }, [dates.checkIn, dates.checkOut, open]);

  const applyDates = (range: DateRange | undefined) => {
    if (!range) {
      setDates({ checkIn: null, checkOut: null });
      return;
    }
    setDates({
      checkIn: range.from ? format(range.from, "yyyy-MM-dd") : null,
      checkOut: range.to ? format(range.to, "yyyy-MM-dd") : null,
    });
  };

  const handleSelect = (range: DateRange | undefined) => {
    setInternalRange(range);

    // Ikkala sana ham tanlanganda avtomatik yopish va URL'ni yangilash
    if (range?.from && range?.to) {
      applyDates(range);
      setOpen(false);
    }
  };

  // Tashqariga bosilganda yopish va chala qolgan tanlovni URL'ga yozish
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        if (open) {
          applyDates(internalRange);
          setOpen(false);
        }
      }
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open, internalRange]);

  // UI matni
  let displayValue = dict?.selectDate;
  if (internalRange?.from && internalRange?.to) {
    displayValue = `${format(internalRange.from, "d-MMM", { locale: locales[locale] })} — ${format(
      internalRange.to,
      "d-MMM",
      { locale: locales[locale] }
    )}`;
  } else if (internalRange?.from) {
    displayValue = format(internalRange.from, "d-MMM", { locale: locales[locale] });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-[220px] items-center gap-3 md:rounded-full bg-transparent px-5 py-4 md:px-5 md:py-3 text-left transition-colors duration-200 hover:bg-slate-50 cursor-pointer active:scale-[0.98]"
      >
        <CalendarIcon className="h-5 w-5 text-blue-600" />
        <span className="flex flex-col">
          <span className="text-xs font-bold text-slate-500">{dict?.checkInCheckOut}</span>
          <span className="text-sm font-bold text-slate-900">{displayValue}</span>
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            className="absolute left-0 sm:-left-4 top-full z-[100] mt-2 w-max max-w-[calc(100vw-2rem)] sm:max-w-none rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-2 md:hidden">
              <span className="font-bold text-sm">{dict?.selectDate}</span>
              <button
                type="button"
                onClick={() => {
                  applyDates(internalRange);
                  setOpen(false);
                }}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
                aria-label="Yopish"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <style
              dangerouslySetInnerHTML={{
                __html: `
              .custom-calendar-styles {
                --rdp-accent-color: #2563eb; /* blue-600 */
                --rdp-accent-background-color: #eff6ff; /* blue-50 */
                --rdp-range_middle-background-color: #eff6ff;
                --rdp-range_middle-color: #1e3a8a; /* blue-900 */
                --rdp-range_start-color: white;
                --rdp-range_start-date-background-color: #2563eb;
                --rdp-range_end-color: white;
                --rdp-range_end-date-background-color: #2563eb;
              }
              .custom-calendar-styles .rdp-day_button {
                transition: transform 0.15s cubic-bezier(0.23, 1, 0.32, 1), background-color 0.15s ease-out;
                border-radius: 9999px;
              }
              .custom-calendar-styles .rdp-day_button:hover {
                transform: scale(1.08);
              }
              .custom-calendar-styles .rdp-day_button:active {
                transform: scale(0.92);
              }
              .dark .custom-calendar-styles {
                --rdp-accent-color: #3b82f6; /* blue-500 */
                --rdp-accent-background-color: rgba(37, 99, 235, 0.2);
                --rdp-range_middle-background-color: rgba(37, 99, 235, 0.2);
                --rdp-range_middle-color: #dbeafe; /* blue-100 */
                --rdp-range_start-color: white;
                --rdp-range_start-date-background-color: #3b82f6;
                --rdp-range_end-color: white;
                --rdp-range_end-date-background-color: #3b82f6;
              }
              /* Explicitly fix any selected text color that might bleed */
              .custom-calendar-styles .rdp-range_middle .rdp-day_button {
                color: var(--rdp-range_middle-color) !important;
              }
            `,
              }}
            />
            <DayPicker
              mode="range"
              selected={internalRange}
              onSelect={handleSelect}
              locale={locales[locale]}
              numberOfMonths={1}
              disabled={{ before: new Date() }} // O'tib ketgan sanalarni bloklash
              className="custom-calendar-styles"
              classNames={{
                months: "flex flex-col sm:flex-row gap-4 sm:gap-6",
                today: "font-bold text-blue-600",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
