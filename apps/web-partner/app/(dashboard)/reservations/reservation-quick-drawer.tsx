"use client";

import {
  BedDouble,
  CalendarCheck,
  CarFront,
  CheckCircle2,
  ExternalLink,
  LogOut,
  Mail,
  Phone,
  User,
  Users,
  UtensilsCrossed,
  Wallet,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { BookingStatus } from "@safaar/types";
import { Button } from "../../_components/ui/button";
import { Drawer } from "../../_components/ui/drawer";
import { ReservationStatusBadge } from "../../_components/domain/reservation-status-badge";
import { SourceBadge } from "../../_components/domain/source-badge";
import type { ReservationView } from "../../_lib/domain/types";
import { formatDate, formatMoney, formatPhone } from "../../_lib/utils/format";
import { useAuthStore } from "../../_stores/auth-store";
import { useDataStore } from "../../_stores/data-store";
import { getPartnerLabels, hasBuses, isRestaurant } from "../../_lib/utils/partner-labels";
import { cn } from "../../_lib/utils/cn";

interface ReservationQuickDrawerProps {
  reservation: ReservationView | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (reservation: ReservationView) => void;
  onReject: (reservation: ReservationView) => void;
  onCheckIn: (reservation: ReservationView) => void;
  onCheckOut?: (reservation: ReservationView) => void;
}

export function ReservationQuickDrawer({
  reservation,
  open,
  onClose,
  onConfirm,
  onReject,
  onCheckIn,
  onCheckOut,
}: ReservationQuickDrawerProps) {
  const beds = useDataStore((s) => s.beds);
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);

  if (!reservation) return null;

  const balance = Math.max(0, reservation.totalPrice - reservation.paidAmount);
  const isPaid = reservation.paidAmount >= reservation.totalPrice && reservation.totalPrice > 0;
  const today = new Date().toISOString().split("T")[0];
  const isPastCheckIn = today > reservation.checkIn.slice(0, 10);
  const isPastCheckOut = today > reservation.checkOut.slice(0, 10);
  const canConfirm =
    (reservation.status === BookingStatus.PENDING ||
      reservation.status === BookingStatus.AWAITING_PARTNER_CONFIRMATION) &&
    !isPastCheckIn;
  const canCheckIn = reservation.status === BookingStatus.CONFIRMED && !isPastCheckOut;
  const canCheckOut = reservation.status === "IN_HOUSE";

  const assignedBed = reservation.bedId
    ? beds.find((b) => b.id === reservation.bedId)
    : undefined;

  const unitTitle = isBus
    ? "Avtomobil"
    : restaurant
      ? "Stol"
      : labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Bron #${reservation.id}`}
      description={`${reservation.guest.fullName} · Tezkor ko'rish`}
      size="md"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <Link
            href={`/reservations/${reservation.id}`}
            onClick={onClose}
            className="inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-button)] border-2 border-[var(--border)] bg-transparent px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] transition-all hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            Batafsil sahifa
          </Link>

          <div className="flex flex-wrap items-center gap-2">
            {canConfirm && (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    onReject(reservation);
                  }}
                >
                  <XCircle className="h-4 w-4" aria-hidden />
                  Rad etish
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    onConfirm(reservation);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" aria-hidden />
                  Tasdiqlash
                </Button>
              </>
            )}
            {canCheckIn && (
              <Button
                size="sm"
                onClick={() => {
                  onCheckIn(reservation);
                }}
              >
                <CalendarCheck className="h-4 w-4" aria-hidden />
                {labels.checkInLabel}
              </Button>
            )}
            {canCheckOut && onCheckOut && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  onCheckOut(reservation);
                }}
              >
                <LogOut className="h-4 w-4" aria-hidden />
                {labels.checkOutLabel}
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5 py-1">
        {/* Status badges header */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-3">
          <SourceBadge source={reservation.source} />
          <ReservationStatusBadge status={reservation.status} />
          {isPaid ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
              To'liq to'langan
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
              Qoldiq to'lov bor
            </span>
          )}
        </div>

        {/* Guest details */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            <User className="h-4 w-4 text-brand-600" aria-hidden />
            Mijoz ma'lumotlari
          </h3>
          <div className="mt-3 flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">Ism-familiya:</span>
              <span className="font-semibold text-[var(--foreground)]">
                {reservation.guest.fullName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">Telefon:</span>
              <a
                href={`tel:${reservation.guest.phone}`}
                className="inline-flex items-center gap-1 font-medium text-brand-600 hover:underline dark:text-brand-400"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden />
                {formatPhone(reservation.guest.phone)}
              </a>
            </div>
            {reservation.guest.email && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted-foreground)]">Email:</span>
                <a
                  href={`mailto:${reservation.guest.email}`}
                  className="inline-flex items-center gap-1 text-xs text-brand-600 hover:underline dark:text-brand-400"
                >
                  <Mail className="h-3.5 w-3.5 text-[var(--muted-foreground)]" aria-hidden />
                  {reservation.guest.email}
                </a>
              </div>
            )}
            {(reservation.adults > 0 || reservation.children > 0) && (
              <div className="flex items-center justify-between">
                <span className="text-[var(--muted-foreground)]">Mehmonlar soni:</span>
                <span className="inline-flex items-center gap-1 text-[var(--foreground)]">
                  <Users className="h-3.5 w-3.5 text-[var(--muted-foreground)]" aria-hidden />
                  {reservation.adults} kattalar
                  {reservation.children > 0 ? `, ${reservation.children} bolalar` : ""}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Booking & Unit Details */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            {isBus ? (
              <CarFront className="h-4 w-4 text-brand-600" aria-hidden />
            ) : restaurant ? (
              <UtensilsCrossed className="h-4 w-4 text-brand-600" aria-hidden />
            ) : (
              <BedDouble className="h-4 w-4 text-brand-600" aria-hidden />
            )}
            {unitTitle} va Muddat
          </h3>
          <div className="mt-3 flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">{unitTitle} turi:</span>
              <span className="font-semibold text-[var(--foreground)]">
                {reservation.roomTypeName}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">Tayinlangan {labels.unitSingular}:</span>
              <span className="font-medium text-[var(--foreground)]">
                {[reservation.roomNumber, assignedBed?.label].filter(Boolean).join(" · ") || (
                  <span className="italic text-[var(--muted-foreground)]">Hali tayinlanmagan</span>
                )}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">
                {isBus ? "Olib ketish" : "Kelish (Check-in)"}:
              </span>
              <span className="font-medium text-[var(--foreground)]">
                {restaurant && reservation.slotTime
                  ? `${formatDate(reservation.checkIn)} · ${reservation.slotTime}`
                  : formatDate(reservation.checkIn)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">
                {isBus ? "Qaytarish" : "Ketish (Check-out)"}:
              </span>
              <span className="font-medium text-[var(--foreground)]">
                {restaurant
                  ? formatDate(reservation.checkOut)
                  : `${formatDate(reservation.checkOut)} (${reservation.nights} ${
                      isBus ? "kun" : "kecha"
                    })`}
              </span>
            </div>
          </div>
        </section>

        {/* Financial breakdown */}
        <section className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
          <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
            <Wallet className="h-4 w-4 text-brand-600" aria-hidden />
            To'lov va Moliya
          </h3>
          <div className="mt-3 flex flex-col gap-2.5 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">Jami narx:</span>
              <span className="text-base font-semibold text-[var(--foreground)]">
                {formatMoney(reservation.totalPrice)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--muted-foreground)]">To'langan:</span>
              <span
                className={cn(
                  "font-medium",
                  reservation.paidAmount > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-[var(--muted-foreground)]",
                )}
              >
                {formatMoney(reservation.paidAmount)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-[var(--border)] pt-2">
              <span className="font-medium text-[var(--foreground)]">Qoldiq to'lov:</span>
              <span
                className={cn(
                  "text-base font-bold",
                  balance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
                )}
              >
                {formatMoney(balance)}
              </span>
            </div>
          </div>
        </section>

        {/* Special requests if present */}
        {reservation.specialRequests && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3.5 text-xs text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
            <p className="font-semibold">Maxsus so'rov / Izoh:</p>
            <p className="mt-1 leading-relaxed">{reservation.specialRequests}</p>
          </div>
        )}
      </div>
    </Drawer>
  );
}
