"use client";

import { CheckCircle2, ChevronRight, Sparkles } from "lucide-react";
import { Card, CardBody } from "../../_components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "../../_components/ui/tabs";
import { ReservationStatusBadge } from "../../_components/domain/reservation-status-badge";
import type { ReservationView } from "../../_lib/domain/types";
import { formatDate } from "../../_lib/utils/format";
import { cn } from "../../_lib/utils/cn";
import { getReservationFilters, type FilterKey } from "./types";

interface ReservationsFocusProps {
  focusItems: ReservationView[];
  counts: Record<FilterKey, number>;
  activeFilter: FilterKey;
  partnerType?: string | null;
  onFilterChange: (filter: FilterKey) => void;
  onSelectReservation: (id: string) => void;
}

export function ReservationsFocus({
  focusItems,
  counts,
  activeFilter,
  partnerType,
  onFilterChange,
  onSelectReservation,
}: ReservationsFocusProps) {
  const filters = getReservationFilters(partnerType);
  return (
    <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
      {/* Priority Focus Card: if empty, show only on xl desktop */}
      <Card
        className={cn(
          "border-[var(--border)] shadow-xs",
          focusItems.length === 0 && "hidden xl:block",
        )}
      >
        <CardBody className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" aria-hidden />
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Diqqat kerak</h2>
              </div>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)] leading-relaxed">
                Yangi bronlar, bugungi kelishlar va to'lov kutilayotganlar.
              </p>
            </div>
            {focusItems.length > 0 && (
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[11px] font-bold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                {focusItems.length}
              </span>
            )}
          </div>

          {focusItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface-muted)] py-6 text-center text-xs text-[var(--muted-foreground)]">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" aria-hidden />
              <span>Hozircha shoshilinch vazifalar yo'q. Hammasi nazorat ostida!</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {focusItems.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelectReservation(r.id)}
                  className={cn(
                    "group relative flex flex-col gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition-all",
                    "hover:border-brand-500/50 hover:bg-brand-50/20 dark:hover:bg-brand-950/20",
                    "focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-[var(--foreground)] group-hover:text-brand-600 dark:group-hover:text-brand-400">
                      {r.guest.fullName}
                    </span>
                    <ChevronRight
                      className="h-4 w-4 shrink-0 text-[var(--muted-foreground)] transition-transform group-hover:translate-x-0.5 group-hover:text-brand-600"
                      aria-hidden
                    />
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">
                    {formatDate(r.checkIn)}
                    {r.slotTime ? ` · ${r.slotTime}` : ""} · {r.roomTypeName}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <ReservationStatusBadge status={r.status} />
                    <span className="font-mono text-[11px] text-[var(--muted-foreground)]">
                      #{r.id}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Status Filter Tabs Card (Desktop XL sidebar only, mobile has horizontal tabs in toolbar) */}
      <Card className="hidden xl:block border-[var(--border)] shadow-xs">
        <CardBody className="flex flex-col gap-2 p-4">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">Status filtrlari</h2>
          <Tabs
            value={activeFilter}
            onValueChange={(val) => onFilterChange(val as FilterKey)}
            orientation="vertical"
            variant="pills"
            className="w-full flex-col gap-1"
          >
            <TabsList
              aria-label="Status bo'yicha saralash"
              className="w-full gap-1 p-0 bg-transparent flex flex-col"
            >
              {filters.map((f) => {
                const active = activeFilter === f.key;
                const count = counts[f.key] ?? 0;
                return (
                  <TabsTrigger
                    key={f.key}
                    value={f.key}
                    className={cn(
                      "w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-all min-h-[42px]",
                      active
                        ? "!bg-brand-600 !text-white shadow-sm"
                        : "text-[var(--foreground)] hover:bg-[var(--surface-muted)]",
                    )}
                  >
                    <span>{f.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums transition-colors",
                        active
                          ? "bg-white/20 text-white"
                          : "bg-[var(--surface-muted)] text-[var(--muted-foreground)] border border-[var(--border)]",
                      )}
                    >
                      {count}
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </Tabs>
        </CardBody>
      </Card>
    </aside>
  );
}
