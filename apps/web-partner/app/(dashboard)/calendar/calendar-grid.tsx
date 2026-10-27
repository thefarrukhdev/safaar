"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarDays, SearchX } from "lucide-react";
import { Button } from "../../_components/ui/button";
import { Card, CardBody } from "../../_components/ui/card";
import { EmptyState } from "../../_components/ui/empty-state";
import { cn } from "../../_lib/utils/cn";
import { TODAY_ISO } from "../../_lib/utils/date";
import type { CalendarRow, CalendarRowBar, ViewMode } from "./types";
import type { ReservationView } from "../../_lib/domain/types";
import { CalendarRoomRow } from "./calendar-room-row";

const WEEKDAY_LABEL = ["Yak", "Du", "Se", "Cho", "Pa", "Ju", "Sha"];

interface CalendarGridProps {
  rows: CalendarRow[];
  days: string[];
  viewMode: ViewMode;
  reservationsByRow: Map<string, CalendarRowBar[]>;
  unitSingular: string;
  unitPlural: string;
  hasActiveFilters: boolean;
  onResetFilters: () => void;
  onEmptyClick: (row: CalendarRow, dateIso: string) => void;
  onSelectReservation: (reservation: ReservationView) => void;
}

export function CalendarGrid({
  rows,
  days,
  viewMode,
  reservationsByRow,
  unitSingular,
  unitPlural,
  hasActiveFilters,
  onResetFilters,
  onEmptyClick,
  onSelectReservation,
}: CalendarGridProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const cellWidth = viewMode === 7 ? 112 : viewMode === 14 ? 68 : 42;
  const roomColWidth = 168;
  const rowHeight = 60;
  const headerHeight = 58;

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -cellWidth * 4, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: cellWidth * 4, behavior: "smooth" });
    }
  };

  if (rows.length === 0) {
    return (
      <Card>
        <CardBody className="py-12">
          {hasActiveFilters ? (
            <EmptyState
              icon={<SearchX className="h-10 w-10 text-[var(--muted-foreground)]" aria-hidden="true" />}
              title="Hech narsa topilmadi"
              description={`Kiritilgan parametrlar bo'yicha hech qanday ${unitSingular} yoki bron mos kelmadi.`}
              action={
                <Button variant="outline" size="sm" onClick={onResetFilters}>
                  Filtrlarni tozalash
                </Button>
              }
            />
          ) : (
            <EmptyState
              icon={<CalendarDays className="h-10 w-10 text-[var(--muted-foreground)]" aria-hidden="true" />}
              title={`${unitPlural.charAt(0).toUpperCase()}${unitPlural.slice(1)} mavjud emas`}
              description={`Kalendarda ko'rish uchun avval ${unitPlural} bo'limidan qo'shing.`}
              action={
                <Button size="sm" asChild>
                  <Link href="/rooms">
                    {unitPlural.charAt(0).toUpperCase() + unitPlural.slice(1)} bo'limiga o'tish
                  </Link>
                </Button>
              }
            />
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <div className="relative rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-xs">
      {/* Scroll yordamchilari */}
      <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-3 py-1.5 text-xs text-[var(--muted-foreground)] bg-[var(--surface-muted)]/30">
        <span className="text-[11px] font-medium">
          Jami: <strong className="text-[var(--foreground)]">{rows.length}</strong> ta {unitPlural.toLowerCase()}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={handleScrollLeft}
            aria-label="Chapga surish"
            className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            title="Chapga surish"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleScrollRight}
            aria-label="O'ngga surish"
            className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            title="O'ngga surish"
          >
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Gorizontal scroll paneli */}
      <div
        ref={scrollContainerRef}
        className="overflow-x-auto overflow-y-hidden"
        style={{ scrollBehavior: "smooth" }}
      >
        <div
          className="relative min-w-full"
          style={{
            display: "grid",
            gridTemplateColumns: `${roomColWidth}px repeat(${viewMode}, ${cellWidth}px)`,
            gridAutoRows: `${rowHeight}px`,
            width: "max-content",
          }}
        >
          {/* Header (sticky top) — chap burchak katagi */}
          <div
            style={{
              gridRow: 1,
              gridColumn: 1,
              height: headerHeight,
              position: "sticky",
              top: 0,
              left: 0,
              zIndex: 30,
            }}
            className="flex items-center justify-between border-b border-r border-[var(--border)] bg-[var(--surface-muted)] px-3 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]"
          >
            <span>
              {unitSingular.charAt(0).toUpperCase()}
              {unitSingular.slice(1)}
            </span>
            <span className="text-[10px] font-semibold text-brand-700 dark:text-brand-300">
              ({rows.length})
            </span>
          </div>

          {/* Header — kun sarlavhalari */}
          {days.map((iso, i) => {
            const d = new Date(iso);
            const isToday = iso === TODAY_ISO;
            const dow = d.getDay();
            const isWeekend = dow === 0 || dow === 6;

            return (
              <div
                key={iso}
                style={{
                  gridRow: 1,
                  gridColumn: i + 2,
                  height: headerHeight,
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                }}
                className={cn(
                  "flex flex-col items-center justify-center border-b border-r border-[var(--border)] text-[10px] font-medium transition-colors select-none",
                  isToday
                    ? "bg-brand-50 text-brand-900 dark:bg-brand-950/60 dark:text-brand-100"
                    : "bg-[var(--surface-muted)] text-[var(--muted-foreground)]",
                  isWeekend && !isToday && "text-zinc-400 dark:text-zinc-500",
                )}
              >
                <span className="uppercase tracking-wide font-semibold text-[10px]">
                  {WEEKDAY_LABEL[dow]}
                </span>
                <span
                  className={cn(
                    "mt-0.5 text-sm font-bold leading-none",
                    isToday &&
                      "inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-white shadow-xs",
                  )}
                >
                  {d.getDate()}
                </span>
              </div>
            );
          })}

          {/* Har bir xona yoki yotoq qatori */}
          {rows.map((row, rIdx) => {
            const gridRow = rIdx + 2;
            const bars = reservationsByRow.get(row.key) ?? [];

            return (
              <CalendarRoomRow
                key={row.key}
                primaryLabel={row.primaryLabel}
                secondaryLabel={row.secondaryLabel}
                isListed={row.isListed}
                nightlyPrice={row.nightlyPrice}
                isOccupiedToday={row.isOccupiedToday}
                gridRow={gridRow}
                days={days}
                bars={bars}
                onEmptyClick={(dateIso) => onEmptyClick(row, dateIso)}
                onSelectReservation={onSelectReservation}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
