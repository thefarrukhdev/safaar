"use client";

import type { Bed, ReservationView } from "../../_lib/domain/types";
import { ReservationCard } from "./reservation-card";

interface ReservationsCardsProps {
  data: ReservationView[];
  beds: Bed[];
  onSelect: (reservation: ReservationView) => void;
  onConfirm: (reservation: ReservationView) => void;
  onReject: (reservation: ReservationView) => void;
  onCheckIn: (reservation: ReservationView) => void;
  onCheckOut?: (reservation: ReservationView) => void;
  onAssignRoom?: (reservation: ReservationView) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  onToggleSelectAll?: () => void;
}

export function ReservationsCards({
  data,
  beds,
  onSelect,
  onConfirm,
  onReject,
  onCheckIn,
  onCheckOut,
  onAssignRoom,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
}: ReservationsCardsProps) {
  const isAllSelected =
    data.length > 0 && selectedIds ? data.every((r) => selectedIds.has(r.id)) : false;
  const isSomeSelected = Boolean(
    selectedIds && data.some((r) => selectedIds.has(r.id)) && !isAllSelected,
  );

  return (
    <div className="flex flex-col gap-3">
      {onToggleSelectAll && data.length > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/60 px-3 py-2 text-xs text-[var(--muted-foreground)]">
          <label className="flex items-center gap-2 cursor-pointer select-none font-medium">
            <input
              type="checkbox"
              checked={isAllSelected}
              ref={(el) => {
                if (el) el.indeterminate = isSomeSelected;
              }}
              onChange={onToggleSelectAll}
              aria-label="Barcha kartalarni tanlash"
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700 cursor-pointer"
            />
            <span>Barcha ko'rsatilgan bronlarni tanlash</span>
          </label>
          {selectedIds && selectedIds.size > 0 && (
            <span className="font-semibold text-brand-600 dark:text-brand-400">
              {selectedIds.size} ta tanlandi
            </span>
          )}
        </div>
      )}

      <div className="grid gap-3">
        {data.map((reservation) => (
          <ReservationCard
            key={reservation.id}
            reservation={reservation}
            beds={beds}
            onOpen={() => onSelect(reservation)}
            onConfirm={() => onConfirm(reservation)}
            onReject={() => onReject(reservation)}
            onCheckIn={() => onCheckIn(reservation)}
            onCheckOut={onCheckOut ? () => onCheckOut(reservation) : undefined}
            onAssignRoom={onAssignRoom ? () => onAssignRoom(reservation) : undefined}
            isSelected={selectedIds?.has(reservation.id) ?? false}
            onToggleSelect={
              onToggleSelect ? () => onToggleSelect(reservation.id) : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}
