"use client";

import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  X,
  Check,
} from "lucide-react";
import { cn } from "../../_lib/utils/cn";

export interface DateRange {
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
}

export interface DateRangePickerProps {
  startDate: string;
  endDate: string;
  onChange: (range: DateRange) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  align?: "left" | "right";
  showPresets?: boolean;
}

const MONTH_NAMES_UZ = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentyabr",
  "Oktyabr",
  "Noyabr",
  "Dekabr",
];

const WEEKDAY_NAMES_UZ = ["Du", "Se", "Ch", "Pa", "Ju", "Sh", "Ya"];

function padZero(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

export function toIsoString(d: Date): string {
  return `${d.getFullYear()}-${padZero(d.getMonth() + 1)}-${padZero(d.getDate())}`;
}

function parseIso(iso: string): Date | null {
  if (!iso) return null;
  const parts = iso.split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function formatDisplayDate(iso: string): string {
  const d = parseIso(iso);
  if (!d) return "";
  const day = d.getDate();
  const month = MONTH_NAMES_UZ[d.getMonth()].slice(0, 3).toLowerCase();
  const year = d.getFullYear();
  return `${day}-${month}, ${year}`;
}

export type PresetKey =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_30_days"
  | "this_month"
  | "last_month"
  | "custom";

interface PresetItem {
  key: PresetKey;
  label: string;
  getRange?: () => DateRange;
}

function getPresets(): PresetItem[] {
  const now = new Date();
  const todayIso = toIsoString(now);

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayIso = toIsoString(yesterday);

  // Bu hafta (Dushanbadan yakshanbagacha)
  const dayOfWeek = now.getDay(); // 0 is Sunday, 1 is Monday
  const diffToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(now);
  monday.setDate(monday.getDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  // Oxirgi 30 kun
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 29);

  // Shu oy
  const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastDayThisMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // O'tgan oy
  const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

  return [
    {
      key: "today",
      label: "Bugun",
      getRange: () => ({ startDate: todayIso, endDate: todayIso }),
    },
    {
      key: "yesterday",
      label: "Kecha",
      getRange: () => ({ startDate: yesterdayIso, endDate: yesterdayIso }),
    },
    {
      key: "this_week",
      label: "Bu hafta",
      getRange: () => ({
        startDate: toIsoString(monday),
        endDate: toIsoString(sunday),
      }),
    },
    {
      key: "last_30_days",
      label: "Oxirgi 30 kun",
      getRange: () => ({
        startDate: toIsoString(thirtyDaysAgo),
        endDate: todayIso,
      }),
    },
    {
      key: "this_month",
      label: "Shu oy",
      getRange: () => ({
        startDate: toIsoString(firstDayThisMonth),
        endDate: toIsoString(lastDayThisMonth),
      }),
    },
    {
      key: "last_month",
      label: "O'tgan oy",
      getRange: () => ({
        startDate: toIsoString(firstDayLastMonth),
        endDate: toIsoString(lastDayLastMonth),
      }),
    },
    {
      key: "custom",
      label: "Maxsus sana",
    },
  ];
}

interface CalendarMonthProps {
  year: number;
  month: number; // 0-11
  startDate: string;
  endDate: string;
  hoverDate: string | null;
  onSelectDate: (iso: string) => void;
  onHoverDate: (iso: string | null) => void;
}

function CalendarMonth({
  year,
  month,
  startDate,
  endDate,
  hoverDate,
  onSelectDate,
  onHoverDate,
}: CalendarMonthProps) {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7; // 0 for Monday

  const todayIso = toIsoString(new Date());

  // Oraliq hisobi: hoverDate preview bo'lib xizmat qiladi
  const effectiveEnd = endDate || hoverDate || "";
  const hasRange = Boolean(startDate && effectiveEnd);
  const isRangeReversed = hasRange && effectiveEnd < startDate;
  const rangeStart = isRangeReversed ? effectiveEnd : startDate;
  const rangeEnd = isRangeReversed ? startDate : effectiveEnd;

  const cells = useMemo(() => {
    const arr: Array<{ day: number; iso: string } | null> = [];
    for (let i = 0; i < firstDayIndex; i++) {
      arr.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      arr.push({
        day: d,
        iso: `${year}-${padZero(month + 1)}-${padZero(d)}`,
      });
    }
    return arr;
  }, [firstDayIndex, daysInMonth, year, month]);

  return (
    <div className="flex flex-col gap-2 select-none">
      <div className="text-sm font-semibold text-center text-slate-800 dark:text-slate-100 py-1">
        {MONTH_NAMES_UZ[month]} {year}
      </div>

      <div className="grid grid-cols-7 gap-1 text-center">
        {WEEKDAY_NAMES_UZ.map((w) => (
          <div
            key={w}
            className="text-[11px] font-medium text-slate-400 dark:text-slate-500 py-1"
          >
            {w}
          </div>
        ))}

        {cells.map((cell, idx) => {
          if (!cell) {
            return <div key={`empty-${idx}`} className="h-9 w-9" />;
          }

          const { day, iso } = cell;
          const isToday = iso === todayIso;
          const isStartEdge = Boolean(rangeStart && iso === rangeStart);
          const isEndEdge = Boolean(rangeEnd && iso === rangeEnd);
          const isSingleEdge = isStartEdge && isEndEdge;
          const isInRange =
            Boolean(rangeStart && rangeEnd && iso > rangeStart && iso < rangeEnd);
          const isPreviewHoverEnd = !endDate && Boolean(hoverDate) && isEndEdge;

          return (
            <button
              key={iso}
              type="button"
              onClick={() => onSelectDate(iso)}
              onMouseEnter={() => onHoverDate(iso)}
              onMouseLeave={() => onHoverDate(null)}
              className={cn(
                "relative h-9 w-9 text-xs font-medium transition-all duration-150 flex items-center justify-center",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                isInRange &&
                  "bg-brand-50 dark:bg-brand-950/40 text-brand-700 dark:text-brand-300 rounded-none",
                isSingleEdge &&
                  "rounded-lg bg-brand-600 text-white font-semibold shadow-sm",
                !isSingleEdge &&
                  isStartEdge &&
                  "rounded-l-lg rounded-r-none bg-brand-600 text-white font-semibold shadow-sm",
                !isSingleEdge &&
                  isEndEdge &&
                  cn(
                    "rounded-r-lg rounded-l-none text-white font-semibold shadow-sm",
                    isPreviewHoverEnd ? "bg-brand-500/90" : "bg-brand-600",
                  ),
                !isStartEdge &&
                  !isEndEdge &&
                  !isInRange &&
                  "rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800",
                isToday &&
                  !isStartEdge &&
                  !isEndEdge &&
                  !isInRange &&
                  "border border-brand-500 font-bold text-brand-600 dark:text-brand-400",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DateRangePicker({
  startDate,
  endDate,
  onChange,
  placeholder = "Sana oralig'ini tanlang",
  className,
  disabled = false,
  align = "left",
  showPresets = true,
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Kalendar oynasi qaysi oydan boshlanishini belgilash
  const [currentYear, setCurrentYear] = useState(() => {
    const d = parseIso(startDate) || new Date();
    return d.getFullYear();
  });
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = parseIso(startDate) || new Date();
    return d.getMonth();
  });

  // Tanlov jarayoni vaqtinchalik xotirasi (oraliq tanlanayotganda)
  const [draftRange, setDraftRange] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const tempStart = draftRange ? draftRange.start : startDate;
  const tempEnd = draftRange ? draftRange.end : endDate;

  const presets = useMemo(() => getPresets(), []);

  // Tashqariga bosilganda yoki Esc bosilganda yopish
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setDraftRange(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
        setDraftRange(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleToggleOpen = () => {
    setIsOpen((prev) => {
      const next = !prev;
      if (next) {
        const targetIso = startDate || endDate;
        const d = parseIso(targetIso);
        if (d) {
          setCurrentYear(d.getFullYear());
          setCurrentMonth(d.getMonth());
        }
      }
      return next;
    });
  };

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Sana bosilganda
  const handleSelectDate = (iso: string) => {
    if (
      !draftRange ||
      (draftRange.start && draftRange.end) ||
      (!draftRange.start && !draftRange.end)
    ) {
      // Yangi oraliq boshlanishi
      setDraftRange({ start: iso, end: "" });
    } else if (draftRange.start && !draftRange.end) {
      // Ikkinchi sana bosildi
      if (iso < draftRange.start) {
        setDraftRange({ start: iso, end: draftRange.start });
      } else {
        setDraftRange({ start: draftRange.start, end: iso });
      }
    }
  };

  const handleApply = () => {
    const s = draftRange ? draftRange.start : startDate;
    const e = draftRange ? draftRange.end : endDate;
    if (s && !e) {
      onChange({ startDate: s, endDate: s });
    } else {
      onChange({ startDate: s, endDate: e });
    }
    setDraftRange(null);
    setIsOpen(false);
  };

  const handleClear = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setDraftRange(null);
    onChange({ startDate: "", endDate: "" });
    setIsOpen(false);
  };

  const handlePresetClick = (preset: PresetItem) => {
    if (!preset.getRange) {
      // "Maxsus sana" tanlandi - oraliqni kalendar orqali erkin tanlash
      setDraftRange({ start: startDate, end: endDate });
      return;
    }
    const range = preset.getRange();
    setDraftRange(null);
    const d = parseIso(range.startDate);
    if (d) {
      setCurrentYear(d.getFullYear());
      setCurrentMonth(d.getMonth());
    }
    onChange(range);
    setIsOpen(false);
  };

  // Trigger tugmasi matni
  const displayText = useMemo(() => {
    if (!startDate && !endDate) return null;
    if (startDate && endDate) {
      if (startDate === endDate) {
        return formatDisplayDate(startDate);
      }
      return `${formatDisplayDate(startDate)} — ${formatDisplayDate(endDate)}`;
    }
    return `${formatDisplayDate(startDate || endDate)} dan`;
  }, [startDate, endDate]);

  const isCustomPresetSelected = useMemo(() => {
    if (!tempStart && !tempEnd) return false;
    return !presets.some((p) => {
      if (!p.getRange) return false;
      const r = p.getRange();
      return tempStart === r.startDate && tempEnd === r.endDate;
    });
  }, [presets, tempStart, tempEnd]);

  // Keyingi oy (2-kalendar uchun)
  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;

  const hasValue = Boolean(startDate || endDate);

  return (
    <div ref={containerRef} className={cn("relative inline-block", className)}>
      {/* Trigger Container: nested button bo'lmasligi uchun ergonomik ajratilgan */}
      <div
        className={cn(
          "inline-flex items-center rounded-xl border transition-all duration-200 min-h-[40px]",
          "bg-white dark:bg-zinc-900 border-slate-200/80 dark:border-zinc-800 shadow-xs",
          "hover:border-slate-300 dark:hover:border-zinc-700 hover:bg-slate-50/50 dark:hover:bg-zinc-800/50",
          isOpen && "ring-2 ring-brand-500 border-transparent",
          disabled && "opacity-50 pointer-events-none",
        )}
      >
        <button
          type="button"
          disabled={disabled}
          onClick={handleToggleOpen}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          className="flex items-center gap-2 px-3 py-2 text-xs sm:text-sm font-medium rounded-l-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 text-left min-h-[38px]"
        >
          <CalendarIcon className="h-4 w-4 text-slate-500 dark:text-slate-400 shrink-0" />
          <span
            className={cn(
              "truncate max-w-[240px]",
              hasValue
                ? "text-slate-900 dark:text-slate-100 font-semibold"
                : "text-slate-500 dark:text-slate-400",
            )}
          >
            {displayText || placeholder}
          </span>
        </button>

        {hasValue && (
          <button
            type="button"
            disabled={disabled}
            onClick={handleClear}
            title="Sanani tozalash"
            aria-label="Sanani tozalash"
            className="mr-2 p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Popover Dropdown */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Sana oralig'ini tanlash"
          className={cn(
            "absolute z-50 mt-2 p-4 rounded-2xl shadow-2xl transition-all duration-200",
            "bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-slate-200/90 dark:border-zinc-800",
            "flex flex-col md:flex-row gap-5 max-w-[calc(100vw-2rem)]",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {/* Presets Sidebar */}
          {showPresets && (
            <div className="flex flex-col gap-1 md:w-36 md:border-r border-slate-200/80 dark:border-zinc-800 md:pr-4">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 py-1">
                Tezkor tanlov
              </span>
              {presets.map((p) => {
                const r = p.getRange ? p.getRange() : null;
                const isSelected =
                  p.key === "custom"
                    ? isCustomPresetSelected
                    : r
                      ? tempStart === r.startDate && tempEnd === r.endDate
                      : false;

                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => handlePresetClick(p)}
                    className={cn(
                      "text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors min-h-[36px]",
                      isSelected
                        ? "bg-brand-50 dark:bg-brand-950/50 text-brand-600 dark:text-brand-400 font-semibold"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-slate-100",
                    )}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          )}

          {/* Calendar Months Section */}
          <div className="flex flex-col gap-4">
            {/* Nav Header */}
            <div className="flex items-center justify-between px-1">
              <button
                type="button"
                onClick={handlePrevMonth}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Oldingi oy"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-xs font-medium text-slate-400">
                1 yoki 2 ta sanani bosing
              </span>
              <button
                type="button"
                onClick={handleNextMonth}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                aria-label="Keyingi oy"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Months Dual / Single Grid */}
            <div className="flex flex-col md:flex-row gap-6">
              <CalendarMonth
                year={currentYear}
                month={currentMonth}
                startDate={tempStart}
                endDate={tempEnd}
                hoverDate={hoverDate}
                onSelectDate={handleSelectDate}
                onHoverDate={setHoverDate}
              />
              <div className="hidden md:block">
                <CalendarMonth
                  year={nextYear}
                  month={nextMonth}
                  startDate={tempStart}
                  endDate={tempEnd}
                  hoverDate={hoverDate}
                  onSelectDate={handleSelectDate}
                  onHoverDate={setHoverDate}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-200/80 dark:border-zinc-800 gap-2">
              <button
                type="button"
                onClick={() => handleClear()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors min-h-[36px]"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Tozalash
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg transition-colors min-h-[36px]"
                >
                  Bekor qilish
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  disabled={!tempStart}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg shadow-sm transition-colors min-h-[36px]"
                >
                  <Check className="h-3.5 w-3.5" />
                  Qo'llash
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
