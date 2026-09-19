"use client";

import { useState, useRef, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { uz, ru, enUS } from "date-fns/locale";
import { Calendar as CalendarIcon, X } from "lucide-react";
import { DayPicker, DateRange } from "react-day-picker";
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

  // 1. Nuqs orqali URL bilan bog'lanish (Single Source of Truth)
  const [dates, setDates] = useQueryStates(
    {
      checkIn: searchParamsParsers.checkIn,
      checkOut: searchParamsParsers.checkOut,
    },
    { shallow: false } // Shallow false means it triggers server fetch when URL changes!
  );

  // 2. React Day Picker uchun Range State
  const selectedRange: DateRange | undefined = {
    from: dates.checkIn ? parseISO(dates.checkIn) : undefined,
    to: dates.checkOut ? parseISO(dates.checkOut) : undefined,
  };

  const handleSelect = (range: DateRange | undefined) => {
    if (!range) {
      setDates({ checkIn: null, checkOut: null });
      return;
    }
    
    setDates({
      checkIn: range.from ? format(range.from, "yyyy-MM-dd") : null,
      checkOut: range.to ? format(range.to, "yyyy-MM-dd") : null,
    });

    if (range.from && range.to) {
      setOpen(false); // Ikkala sana tanlangach, oynani yopish
    }
  };

  // Tashqariga bosilganda yopish
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // UI matni
  let displayValue = dict?.selectDate ?? "Sanani tanlang";
  if (selectedRange.from && selectedRange.to) {
    displayValue = `${format(selectedRange.from, "d-MMM", { locale: locales[locale] })} — ${format(
      selectedRange.to,
      "d-MMM",
      { locale: locales[locale] }
    )}`;
  } else if (selectedRange.from) {
    displayValue = format(selectedRange.from, "d-MMM", { locale: locales[locale] });
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full min-w-[220px] items-center gap-3 rounded-full bg-transparent px-4 py-3 text-left transition-colors duration-200 hover:bg-slate-900/[0.03]"
      >
        <CalendarIcon className="h-5 w-5 text-primary-600" />
        <span className="flex flex-col">
          <span className="text-xs font-bold text-slate-500">{dict?.checkInCheckOut ?? "Kirish - Chiqish"}</span>
          <span className="text-sm font-bold text-slate-900 dark:text-white">
            {displayValue}
          </span>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 rounded-xl border border-slate-900/[0.08] bg-white p-4 shadow-float dark:border-slate-800 dark:bg-slate-900 animate-in fade-in zoom-in-95">
          <div className="flex justify-between items-center mb-2 md:hidden">
             <span className="font-bold text-sm">{dict?.selectDate ?? "Sanani tanlang"}</span>
             <button onClick={() => setOpen(false)}><X className="h-5 w-5"/></button>
          </div>
          
          {/* DayPicker (Calendar) */}
          <DayPicker
            mode="range"
            selected={selectedRange}
            onSelect={handleSelect}
            locale={locales[locale]}
            numberOfMonths={2}
            disabled={{ before: new Date() }} // O'tib ketgan sanalarni bloklash
            className="custom-calendar-styles"
            classNames={{
              selected: "bg-primary-600 text-white hover:bg-primary-600 focus:bg-primary-600",
              today: "font-bold text-primary-600",
            }}
          />
        </div>
      )}
    </div>
  );
}
