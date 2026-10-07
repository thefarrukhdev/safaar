"use client";

import { useEffect, useMemo, useRef, useState } from"react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from"lucide-react";
import type { Locale } from"@/i18n/config";

function toISO(d: Date): string {
 const y = d.getFullYear();
 const m = String(d.getMonth() + 1).padStart(2,"0");
 const day = String(d.getDate()).padStart(2,"0");
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
"Yanvar","Fevral","Mart","Aprel","May","Iyun",
"Iyul","Avgust","Sentyabr","Oktyabr","Noyabr","Dekabr",
];

const UZ_MONTHS_SHORT = [
"Yan","Fev","Mar","Apr","May","Iyn",
"Iyl","Avg","Sen","Okt","Noy","Dek",
];

const UZ_WEEKDAYS = ["Dush","Sesh","Chor","Pay","Juma","Shan","Yak"];

const INTL_LOCALE: Record<string, string> = {
 uz:"ru-RU",
 ru:"ru-RU",
 en:"en-US",
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
 checkInPlaceholder ="Sana tanlang",
 checkOutPlaceholder ="Sana tanlang",
 className,
}: DateRangePickerProps) {
 const [open, setOpen] = useState(false);
 const [step, setStep] = useState<"checkIn"|"checkOut">("checkIn");
 const ref = useRef<HTMLDivElement>(null);

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
 if (step ==="checkIn"&& parsedCheckIn) {
 setView(new Date(parsedCheckIn));
 } else if (step ==="checkOut"&& parsedCheckOut) {
 setView(new Date(parsedCheckOut));
 } else if (step ==="checkOut"&& parsedCheckIn) {
 setView(new Date(parsedCheckIn));
 }
 }
 }, [step, open, checkIn, checkOut]);

 useEffect(() => {
 if (!open) return;
 function onClick(e: MouseEvent) {
 if (ref.current && !ref.current.contains(e.target as Node)) {
 setOpen(false);
 }
 }
 function onKey(e: KeyboardEvent) {
 if (e.key ==="Escape") setOpen(false);
 }
 document.addEventListener("mousedown", onClick);
 document.addEventListener("keydown", onKey);
 return () => {
 document.removeEventListener("mousedown", onClick);
 document.removeEventListener("keydown", onKey);
 };
 }, [open]);

 const intlLocale = INTL_LOCALE[locale] ??"en-US";

 const monthLabel = useMemo(() => {
 if (locale ==="uz") {
 return `${UZ_MONTHS[view.getMonth()]} ${view.getFullYear()}`;
 }
 return new Intl.DateTimeFormat(intlLocale, {
 month:"long",
 year:"numeric",
 }).format(view);
 }, [locale, intlLocale, view]);

 const weekdays = useMemo(() => {
 if (locale ==="uz") {
 return UZ_WEEKDAYS;
 }
 const fmt = new Intl.DateTimeFormat(intlLocale, { weekday:"short"});
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
 const d = parseISO(val ||"");
 if (!d) return null;
 if (locale ==="uz") {
 return `${d.getDate()}-${UZ_MONTHS_SHORT[d.getMonth()]}. ${d.getFullYear()} y.`;
 }
 return new Intl.DateTimeFormat(intlLocale, {
 day:"numeric",
 month:"short",
 year:"numeric",
 }).format(d);
 };

 const checkInDisplay = formatDisplay(checkIn);
 const checkOutDisplay = formatDisplay(checkOut);

 const todayISO = toISO(startOfDay(new Date()));

 function isDisabled(d: Date): boolean {
 const targetDate = startOfDay(d);
 if (step ==="checkIn") {
 if (!baseMinDate) return false;
 return targetDate < startOfDay(baseMinDate);
 } else {
 const minOut = selectedCheckIn ? addDays(selectedCheckIn, 1) : (baseMinDate || new Date());
 return targetDate < startOfDay(minOut);
 }
 }

 const handleDayClick = (iso: string) => {
 if (step ==="checkIn") {
 onCheckInChange(iso);
 if (checkOut && iso >= checkOut) {
 onCheckOutChange("");
 }
 setStep("checkOut");
 } else {
 onCheckOutChange(iso);
 setOpen(false);
 }
 };

 const toggleOpen = (newStep:"checkIn"|"checkOut") => {
 if (!open) {
 setStep(newStep);
 setOpen(true);
 } else {
 if (step === newStep) {
 setOpen(false);
 } else {
 setStep(newStep);
 }
 }
 };

 return (
 <div ref={ref} className={`relative flex-1 ${className ??""}`}>
 <div className="flex w-full items-center rounded-xl border border-slate-300 bg-white transition-all hover:border-slate-400 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500">
 
 {/* Kirish qismi */}
 <button
 type="button"
 onClick={() => toggleOpen("checkIn")}
 className={`group flex flex-1 items-center gap-3 px-3.5 py-2.5 text-left rounded-l-xl focus-visible:outline-none ${open && step ==="checkIn"?"bg-blue-50/50":""}`}
 >
 <span className={`shrink-0 transition-colors ${open && step ==="checkIn"?"text-blue-600":"text-slate-500 group-hover:text-blue-600"}`}>
 <CalendarIcon className="h-4 w-4"/>
 </span>
 <span className="flex min-w-0 flex-1 flex-col">
 <span className={`text-[11px] font-bold ${open && step ==="checkIn"?"text-blue-600":"text-slate-500"}`}>
 {checkInLabel}
 </span>
 <span className={`truncate text-xs font-bold ${checkInDisplay ?"text-slate-900":"text-slate-400"}`}>
 {checkInDisplay ?? checkInPlaceholder}
 </span>
 </span>
 </button>

 <div className="w-px h-10 bg-slate-200 shrink-0"/>

 {/* Chiqish qismi */}
 <button
 type="button"
 onClick={() => toggleOpen("checkOut")}
 className={`group flex flex-1 items-center gap-3 px-3.5 py-2.5 text-left rounded-r-xl focus-visible:outline-none ${open && step ==="checkOut"?"bg-blue-50/50":""}`}
 >
 <span className={`shrink-0 transition-colors ${open && step ==="checkOut"?"text-blue-600":"text-slate-500 group-hover:text-blue-600"}`}>
 <CalendarIcon className="h-4 w-4"/>
 </span>
 <span className="flex min-w-0 flex-1 flex-col">
 <span className={`text-[11px] font-bold ${open && step ==="checkOut"?"text-blue-600":"text-slate-500"}`}>
 {checkOutLabel}
 </span>
 <span className={`truncate text-xs font-bold ${checkOutDisplay ?"text-slate-900":"text-slate-400"}`}>
 {checkOutDisplay ?? checkOutPlaceholder}
 </span>
 </span>
 </button>

 </div>

 {open && (
 <>
 <div className="fixed inset-0 z-40 bg-black/40 md:hidden"aria-hidden />
 <div className="fixed inset-x-4 top-1/2 z-50 -translate-y-1/2 rounded-xl border border-slate-200 bg-white p-4 md:absolute md:inset-auto md:left-0 md:top-full md:z-50 md:mt-2 md:w-72 md:translate-y-0 animate-in fade-in zoom-in-95 duration-100">
 {/* Step Indicator */}
 <div className="mb-3 text-center md:text-left text-xs font-bold text-blue-600 pb-2 border-b border-slate-100">
 {step ==="checkIn"? `1-qadam: ${checkInLabel}` : `2-qadam: ${checkOutLabel}`}
 </div>
 
 {/* Mobile Header with Close Button */}
 <div className="flex items-center justify-between mb-3 md:hidden absolute right-4 top-4">
 <button
 type="button"
 onClick={() => setOpen(false)}
 className="text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors"
 aria-label="Close"
 >
 <X className="h-4 w-4"/>
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
 className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600"
 >
 <ChevronLeft className="h-4 w-4"/>
 </button>
 <span className="text-xs font-black uppercase tracking-wider text-slate-900">
 {monthLabel}
 </span>
 <button
 type="button"
 onClick={() =>
 setView((v) => new Date(v.getFullYear(), v.getMonth() + 1, 1))
 }
 aria-label="next"
 className="grid h-8 w-8 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600"
 >
 <ChevronRight className="h-4 w-4"/>
 </button>
 </div>

 {/* Hafta kunlari */}
 <div className="mb-1 grid grid-cols-7 gap-1">
 {weekdays.map((w) => (
 <span
 key={w}
 className="grid h-8 place-items-center text-[10px] font-black uppercase text-slate-400"
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
 
 // Highlight logic for range
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
 onClick={() => handleDayClick(iso)}
 className={`grid h-8 w-8 place-items-center rounded-full text-xs font-bold transition-all duration-150 active:scale-[0.97]
 ${
 isSelected
 ?"bg-blue-600 text-white"
 : isRange
 ?"bg-blue-50 text-blue-700"
 : disabled
 ?"cursor-not-allowed text-slate-300"
 :"text-slate-800 hover:bg-blue-50 hover:text-blue-700"
 }
 ${!isSelected && !isRange && isToday ?"ring-1 ring-blue-400":""}
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
