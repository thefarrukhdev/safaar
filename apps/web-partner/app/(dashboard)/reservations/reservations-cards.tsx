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
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export function ReservationsCards({
  data,
  beds,
  onSelect,
  onConfirm,
  onReject,
  onCheckIn,
  onCheckOut,
  selectedIds,
  onToggleSelect,
}: ReservationsCardsProps) {
  return (
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
          isSelected={selectedIds?.has(reservation.id) ?? false}
          onToggleSelect={
            onToggleSelect ? () => onToggleSelect(reservation.id) : undefined
          }
        />
      ))}
    </div>
  );
}
