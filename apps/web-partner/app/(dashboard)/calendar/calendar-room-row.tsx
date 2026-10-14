"use client";

import { Plus } from "lucide-react";
import { cn } from "../../_lib/utils/cn";
import { formatMoney } from "../../_lib/utils/format";
import { TODAY_ISO } from "../../_lib/utils/date";
import type { CalendarRowBar } from "./types";
import type { ReservationView } from "../../_lib/domain/types";
import { ReservationBar } from "./_components/reservation-bar";

interface CalendarRoomRowProps {
  primaryLabel: string;
  secondaryLabel: string;
  isListed: boolean;
  nightlyPrice?: number;
  isOccupiedToday?: boolean;
  gridRow: number;
  days: string[];
  bars: CalendarRowBar[];
  onEmptyClick: (dateIso: string) => void;
  onSelectReservation?: (reservation: ReservationView) => void;
}

export function CalendarRoomRow({
  primaryLabel,
  secondaryLabel,
  isListed,
  nightlyPrice,
  isOccupiedToday,
  gridRow,
  days,
  bars,
  onEmptyClick,
  onSelectReservation,
}: CalendarRoomRowProps) {
  return (
    <>
      {/* Sticky xona ma'lumotlari ustuni (chapda qotirilgan) */}
      <div
        style={{
          gridRow,
          gridColumn: 1,
          position: "sticky",
          left: 0,
          zIndex: 15,
        }}
        className="flex min-w-0 flex-col items-start justify-center border-b border-r border-[var(--border)] bg-[var(--surface)] px-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:bg-zinc-900"
      >
        <div className="flex w-full items-center justify-between gap-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            {isOccupiedToday && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-accent-500 ring-2 ring-accent-200 dark:ring-accent-950"
                title="Bugun band"
                aria-label="Bugun band"
              />
            )}
            <span className="font-mono text-sm font-bold tracking-tight text-[var(--foreground)] truncate">
              {primaryLabel}
            </span>
          </div>

          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0",
              isListed
                ? "bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300 border border-accent-200/60 dark:border-accent-900/60"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
            )}
          >
            {isListed ? "E'londa" : "Yopiq"}
          </span>
        </div>

        <span className="mt-1 flex w-full items-center justify-between gap-1 truncate text-[10px] text-[var(--muted-foreground)]">
          <span className="truncate">{secondaryLabel}</span>
          {nightlyPrice ? (
            <span className="shrink-0 font-medium text-[var(--foreground)]/80">
              {formatMoney(nightlyPrice)}
            </span>
          ) : null}
        </span>
      </div>

      {/* Kun katakchalari (bo'sh, klikga ochiq) */}
      {days.map((iso, i) => {
        const isToday = iso === TODAY_ISO;
        const dow = new Date(iso).getDay();
        const isWeekend = dow === 0 || dow === 6;

        return (
          <button
            key={iso}
            type="button"
            onClick={() => onEmptyClick(iso)}
            aria-label={`${primaryLabel}, ${iso} uchun bron yaratish`}
            title={`${primaryLabel} · ${iso} (Bo'sh) — yangi bron yaratish uchun bosing`}
            style={{ gridRow, gridColumn: i + 2 }}
            className={cn(
              "group relative flex items-center justify-center border-b border-r border-[var(--border)] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500",
              "hover:bg-brand-50/80 dark:hover:bg-brand-900/25",
              isToday && "bg-brand-50/40 dark:bg-brand-950/20",
              isWeekend && !isToday && "bg-[var(--surface-muted)]/50",
            )}
          >
            <Plus
              className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 opacity-0 transition-all duration-150 group-hover:scale-110 group-hover:opacity-100"
              aria-hidden="true"
            />
          </button>
        );
      })}

      {/* Bron chiziqlari — kataklar ustiga qoplanadi */}
      {bars.map((b) => (
        <ReservationBar
          key={b.reservation.id}
          reservation={b.reservation}
          gridRow={gridRow}
          startCol={b.startCol}
          spanCols={b.spanCols}
          truncatedStart={b.truncatedStart}
          truncatedEnd={b.truncatedEnd}
          onSelect={onSelectReservation}
        />
      ))}
    </>
  );
}
