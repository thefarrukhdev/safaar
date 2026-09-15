"use client";

import { useRouter } from "next/navigation";
import { BookingStatus } from "@safaar/types";
import type { ReservationView } from "../../../_lib/domain/types";
import { cn } from "../../../_lib/utils/cn";
import { formatDate, formatMoney, formatPhone } from "../../../_lib/utils/format";
import { useAuthStore } from "../../../_stores/auth-store";
import { getPartnerLabels, isRestaurant } from "../../../_lib/utils/partner-labels";

function statusClasses(status: ReservationView["status"]): string {
  switch (status) {
    case BookingStatus.PENDING:
    case BookingStatus.AWAITING_PAYMENT:
    case BookingStatus.AWAITING_PARTNER_CONFIRMATION:
      return "bg-amber-400 hover:bg-amber-500 text-amber-950 ring-amber-500";
    case BookingStatus.CONFIRMED:
      return "bg-brand-500 hover:bg-brand-600 text-white ring-brand-700";
    case "IN_HOUSE":
      return "bg-accent-500 hover:bg-accent-600 text-white ring-accent-700";
    case BookingStatus.COMPLETED:
      return "bg-zinc-400 hover:bg-zinc-500 text-white ring-zinc-600";
    case BookingStatus.CANCELLED:
    case BookingStatus.EXPIRED:
      return "bg-red-400 hover:bg-red-500 text-white ring-red-600";
    default:
      return "bg-zinc-300";
  }
}

interface ReservationBarProps {
  reservation: ReservationView;
  gridRow: number;
  startCol: number;
  spanCols: number;
  /** Boshida kesilganmi (bron undan oldin boshlangan) */
  truncatedStart: boolean;
  /** Oxirida kesilganmi (bron keyinroq tugaydi) */
  truncatedEnd: boolean;
}

export function ReservationBar({
  reservation,
  gridRow,
  startCol,
  spanCols,
  truncatedStart,
  truncatedEnd,
}: ReservationBarProps) {
  const router = useRouter();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const restaurant = isRestaurant(partnerType);
  const unitCap = labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1);
  const balance = reservation.totalPrice - reservation.paidAmount;
  const paymentLabel =
    reservation.paidAmount <= 0
      ? "To'lanmagan"
      : balance > 0
        ? "Qisman"
        : "To'langan";
  const paymentClass =
    reservation.paidAmount <= 0
      ? "bg-red-100 text-red-700"
      : balance > 0
        ? "bg-white/80 text-amber-800"
        : "bg-white/80 text-accent-700";

  return (
    <div
      style={{
        gridRow,
        gridColumn: `${startCol} / span ${spanCols}`,
      }}
      className="group relative my-1 mx-0.5 flex"
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          router.push(`/reservations/${reservation.id}`);
        }}
        title={
          restaurant
            ? `${reservation.guest.fullName} · ${formatDate(reservation.checkIn)} ${reservation.slotTime ?? ""}`
            : `${reservation.guest.fullName} · ${formatDate(reservation.checkIn)} → ${formatDate(reservation.checkOut)}`
        }
        className={cn(
          "flex h-full w-full min-w-0 items-center gap-1.5 px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 focus-visible:ring-offset-[var(--surface)]",
          statusClasses(reservation.status),
          truncatedStart ? "rounded-l-none" : "rounded-l-md",
          truncatedEnd ? "rounded-r-none" : "rounded-r-md",
        )}
      >
        <span className="min-w-0 flex-1 truncate">
          {reservation.guest.fullName}
        </span>
        {spanCols >= 2 && !(reservation.status === BookingStatus.COMPLETED && reservation.totalPrice === 0) && (
          <span
            className={cn(
              "hidden shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold leading-none sm:inline-flex",
              paymentClass,
            )}
          >
            {paymentLabel}
          </span>
        )}
      </button>

      {/* Rich tooltip — hover'da */}
      <div className="pointer-events-none absolute left-1/2 top-full z-40 mt-1 hidden -translate-x-1/2 min-w-[220px] rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-left text-xs shadow-xl group-hover:block group-focus-within:block">
        <p className="font-semibold">{reservation.guest.fullName}</p>
        <p className="text-[var(--muted-foreground)]">
          {formatPhone(reservation.guest.phone)}
        </p>
        <div className="my-2 h-px bg-[var(--border)]" />
        {restaurant ? (
          <p>
            <span className="text-[var(--muted-foreground)]">Vaqt: </span>
            {formatDate(reservation.checkIn)}
            {reservation.slotTime && ` · ${reservation.slotTime}`}
          </p>
        ) : (
          <p>
            <span className="text-[var(--muted-foreground)]">Sanalar: </span>
            {formatDate(reservation.checkIn)} →{" "}
            {formatDate(reservation.checkOut)}
            <span className="text-[var(--muted-foreground)]">
              {" "}
              ({reservation.nights} kech.)
            </span>
          </p>
        )}
        <p>
          <span className="text-[var(--muted-foreground)]">{unitCap}: </span>
          {reservation.roomTypeName}
          {reservation.roomNumber && (
            <span className="font-mono text-brand-700 dark:text-brand-300">
              {" "}
              · {reservation.roomNumber}
            </span>
          )}
        </p>
        {!(reservation.status === BookingStatus.COMPLETED && reservation.totalPrice === 0) && (
          <>
            <p>
              <span className="text-[var(--muted-foreground)]">Summa: </span>
              <span className="font-semibold">
                {formatMoney(reservation.totalPrice)}
              </span>
            </p>
            <p>
              <span className="text-[var(--muted-foreground)]">Oldindan: </span>
              <span className="font-semibold">
                {formatMoney(reservation.paidAmount)}
              </span>
            </p>
            {balance > 0 && (
              <p className="text-red-600">
                Qoldiq: {formatMoney(balance)}
              </p>
            )}
          </>
        )}
        <p className="mt-1 text-[10px] text-[var(--muted-foreground)]">
          Tafsilot uchun bosing
        </p>
      </div>
    </div>
  );
}
