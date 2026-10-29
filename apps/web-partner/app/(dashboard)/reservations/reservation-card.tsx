"use client";

import {
  BedDouble,
  CalendarCheck,
  CalendarDays,
  CarFront,
  CheckCircle2,
  Copy,
  DoorOpen,
  ExternalLink,
  Eye,
  LogOut,
  MoreVertical,
  Phone,
  Users,
  UtensilsCrossed,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import { Button } from "../../_components/ui/button";
import { Card, CardBody } from "../../_components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../_components/ui/dropdown-menu";
import { ReservationStatusBadge } from "../../_components/domain/reservation-status-badge";
import { SourceBadge } from "../../_components/domain/source-badge";
import type { Bed, ReservationView } from "../../_lib/domain/types";
import { formatDate, formatMoney, formatPhone } from "../../_lib/utils/format";
import { cn } from "../../_lib/utils/cn";
import { getPartnerLabels, hasBuses, isRestaurant } from "../../_lib/utils/partner-labels";
import { useAuthStore } from "../../_stores/auth-store";

interface ReservationCardProps {
  reservation: ReservationView;
  beds?: Bed[];
  onOpen: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onCheckIn: () => void;
  onCheckOut?: () => void;
  onAssignRoom?: () => void;
  isSelected?: boolean;
  onToggleSelect?: () => void;
}

export function ReservationCard({
  reservation,
  beds = [],
  onOpen,
  onConfirm,
  onReject,
  onCheckIn,
  onCheckOut,
  onAssignRoom,
  isSelected = false,
  onToggleSelect,
}: ReservationCardProps) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);

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
  const canAssignRoom =
    reservation.status !== BookingStatus.CANCELLED &&
    reservation.status !== BookingStatus.COMPLETED;

  const assignedBed = reservation.bedId ? beds.find((b) => b.id === reservation.bedId) : undefined;
  const assignedUnit = [reservation.roomNumber, assignedBed?.label].filter(Boolean).join(" · ");

  const cleanPhone = reservation.guest.phone
    ? reservation.guest.phone.replace(/[^\d+]/g, "")
    : "";
  const telHref = cleanPhone ? `tel:${cleanPhone}` : undefined;

  const handleCopyPhone = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!reservation.guest.phone) return;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(reservation.guest.phone);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = reservation.guest.phone;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Telefon raqami nusxalandi");
    } catch {
      toast.error("Raqamni nusxalab bo'lmadi");
    }
  };

  return (
    <Card
      interactive
      className={cn(
        "group relative transition-all border-[var(--border)] bg-[var(--surface)] shadow-xs",
        isSelected && "ring-2 ring-brand-500 bg-brand-50/15 dark:bg-brand-950/20 border-brand-300 dark:border-brand-800",
      )}
    >
      <CardBody className="p-0">
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
          className="grid w-full cursor-pointer gap-0 text-left lg:grid-cols-[minmax(0,1fr)_260px]"
        >
          {/* Main Info Column */}
          <div className="flex min-w-0 flex-col gap-3.5 p-4 sm:p-5">
            {/* Top Badges & Selection Row */}
            <div className="flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex flex-wrap items-center gap-2">
                {onToggleSelect && (
                  <div
                    className="flex items-center justify-center -ml-1 mr-1"
                    onClick={(e) => e.stopPropagation()}
                    onKeyDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={onToggleSelect}
                      aria-label={`${reservation.id} bronni tanlash`}
                      className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500 dark:border-zinc-700 cursor-pointer"
                    />
                  </div>
                )}
                <span className="font-mono text-xs font-bold text-brand-700 dark:text-brand-300">
                  #{reservation.id}
                </span>
                <SourceBadge source={reservation.source} />
                <ReservationStatusBadge status={reservation.status} />
                {isPaid ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
                    To'liq to'langan
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
                    Qoldiq: {formatMoney(balance)}
                  </span>
                )}
              </div>

              {/* Quick View hint */}
              <div className="hidden sm:flex items-center gap-1 text-xs text-[var(--muted-foreground)] group-hover:text-brand-600 transition-colors">
                <Eye className="h-3.5 w-3.5" aria-hidden />
                <span>Tezkor ko'rish</span>
              </div>
            </div>

            {/* Guest Summary */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-base sm:text-lg font-bold text-[var(--foreground)] group-hover:text-brand-600 transition-colors">
                  {reservation.guest.fullName}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]">
                  {telHref ? (
                    <a
                      href={telHref}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 font-medium text-brand-600 dark:text-brand-400 hover:underline min-h-[32px] sm:min-h-0"
                    >
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      <span>{formatPhone(reservation.guest.phone)}</span>
                    </a>
                  ) : (
                    <span>Telefon yo'q</span>
                  )}
                  {(reservation.adults > 0 || reservation.children > 0) && (
                    <span className="inline-flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" aria-hidden />
                      {reservation.adults} kattalar
                      {reservation.children > 0 ? `, ${reservation.children} bolalar` : ""}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Mini Info Details */}
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg bg-[var(--surface-muted)] p-2.5 border border-[var(--border)]">
                <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                  <CalendarDays className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                  {isBus ? "Olib ketish" : restaurant ? "Tashrif" : "Kelish"}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-[var(--foreground)]">
                  {restaurant && reservation.slotTime
                    ? `${formatDate(reservation.checkIn)} · ${reservation.slotTime}`
                    : formatDate(reservation.checkIn)}
                </p>
              </div>

              <div className="rounded-lg bg-[var(--surface-muted)] p-2.5 border border-[var(--border)]">
                <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                  <CalendarDays className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                  {isBus ? "Qaytarish" : restaurant ? "Tashrif kuni" : "Ketish"}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-[var(--foreground)]">
                  {restaurant
                    ? formatDate(reservation.checkOut)
                    : `${formatDate(reservation.checkOut)} (${reservation.nights} ${
                        isBus ? "kun" : restaurant ? "tashrif" : "kecha"
                      })`}
                </p>
              </div>

              <div className="rounded-lg bg-[var(--surface-muted)] p-2.5 border border-[var(--border)]">
                <p className="flex items-center gap-1 text-[11px] font-medium text-[var(--muted-foreground)]">
                  {isBus ? (
                    <CarFront className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                  ) : restaurant ? (
                    <UtensilsCrossed className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                  ) : (
                    <BedDouble className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                  )}
                  {labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)}
                </p>
                <p className="mt-0.5 truncate text-xs font-semibold text-[var(--foreground)]">
                  {reservation.roomTypeName}
                  {assignedUnit ? ` · ${assignedUnit}` : " · Belgilanmagan"}
                </p>
              </div>
            </div>

            {/* Special Requests */}
            {reservation.specialRequests && (
              <p className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 text-xs text-amber-900 dark:border-amber-900/30 dark:bg-amber-950/20 dark:text-amber-200">
                <span className="font-semibold">Izoh: </span>
                {reservation.specialRequests}
              </p>
            )}
          </div>

          {/* Financial & Actions Column */}
          <div className="flex flex-col justify-between gap-3 border-t border-[var(--border)] p-4 sm:p-5 lg:border-l lg:border-t-0 bg-[var(--surface-muted)]/30">
            {/* Financial Rows */}
            <div className="flex flex-col gap-1.5 text-xs">
              {reservation.totalPrice <= 0 ? (
                <div className="flex items-center justify-between py-1">
                  <span className="text-[var(--muted-foreground)]">To'lov:</span>
                  <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">
                    Bepul bron
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted-foreground)]">Jami narx:</span>
                    <span className="font-bold text-sm text-[var(--foreground)]">
                      {formatMoney(reservation.totalPrice)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[var(--muted-foreground)]">To'langan:</span>
                    <span
                      className={cn(
                        "font-semibold",
                        reservation.paidAmount > 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-[var(--muted-foreground)]",
                      )}
                    >
                      {formatMoney(reservation.paidAmount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[var(--border)] pt-1.5">
                    <span className="font-medium text-[var(--foreground)]">Qoldiq:</span>
                    <span
                      className={cn(
                        "font-bold text-sm tabular-nums",
                        balance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
                      )}
                    >
                      {formatMoney(balance)}
                    </span>
                  </div>
                </>
              )}
            </div>


            {/* Actions Bar */}
            <div
              className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[var(--border)]"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {canConfirm && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={onReject}
                    className="min-h-[40px] sm:min-h-[34px] px-2.5 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <XCircle className="h-3.5 w-3.5 mr-1" aria-hidden />
                    Rad etish
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={onConfirm}
                    className="min-h-[40px] sm:min-h-[34px] px-2.5 text-xs bg-brand-600 hover:bg-brand-700 text-white"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5 mr-1" aria-hidden />
                    Tasdiqlash
                  </Button>
                </>
              )}

              {canCheckIn && (
                <Button
                  type="button"
                  size="sm"
                  onClick={onCheckIn}
                  className="min-h-[40px] sm:min-h-[34px] px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                >
                  <CalendarCheck className="h-3.5 w-3.5 mr-1" aria-hidden />
                  {labels.checkInActionLabel ?? labels.checkInLabel}
                </Button>
              )}

              {canCheckOut && onCheckOut && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={onCheckOut}
                  className="min-h-[40px] sm:min-h-[34px] px-3 text-xs"
                >
                  <LogOut className="h-3.5 w-3.5 mr-1" aria-hidden />
                  {labels.checkOutActionLabel ?? labels.checkOutLabel}
                </Button>
              )}

              {/* 3-Dot Dropdown Menu for Staff */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Qo'shimcha amallar"
                    className="h-10 w-10 min-h-[40px] min-w-[40px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)]"
                  >
                    <MoreVertical className="h-4 w-4" aria-hidden />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" side="bottom" className="w-56">
                  <DropdownMenuLabel>Bron amallari</DropdownMenuLabel>
                  <DropdownMenuItem onClick={onOpen}>
                    <Eye className="h-4 w-4 mr-2 text-brand-600" />
                    <span>Tezkor ko'rish</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem asChild>
                    <Link href={`/reservations/${reservation.id}`}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      <span>Batafsil sahifa</span>
                    </Link>
                  </DropdownMenuItem>

                  {reservation.guest.phone && (
                    <>
                      <DropdownMenuItem onClick={handleCopyPhone}>
                        <Copy className="h-4 w-4 mr-2" />
                        <span>Raqamni nusxalash</span>
                      </DropdownMenuItem>

                      {telHref && (
                        <DropdownMenuItem asChild>
                          <a href={telHref}>
                            <Phone className="h-4 w-4 mr-2 text-emerald-600" />
                            <span>Qo'ng'iroq qilish</span>
                          </a>
                        </DropdownMenuItem>
                      )}
                    </>
                  )}

                  <DropdownMenuSeparator />

                  {canAssignRoom && onAssignRoom && (
                    <DropdownMenuItem onClick={onAssignRoom}>
                      <DoorOpen className="h-4 w-4 mr-2 text-brand-600" />
                      <span>{reservation.roomNumber ? `${labels.unitSingular}ni almashtirish` : `${labels.unitSingular}ni biriktirish`}</span>
                    </DropdownMenuItem>
                  )}

                  {canConfirm && (
                    <>
                      <DropdownMenuItem onClick={onConfirm}>
                        <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />
                        <span>Tasdiqlash</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={onReject} className="text-red-600 focus:text-red-600">
                        <XCircle className="h-4 w-4 mr-2 text-red-600" />
                        <span>Rad etish</span>
                      </DropdownMenuItem>
                    </>
                  )}

                  {canCheckIn && (
                    <DropdownMenuItem onClick={onCheckIn}>
                      <CalendarCheck className="h-4 w-4 mr-2 text-emerald-600" />
                      <span>{labels.checkInLabel}</span>
                    </DropdownMenuItem>
                  )}

                  {canCheckOut && onCheckOut && (
                    <DropdownMenuItem onClick={onCheckOut}>
                      <LogOut className="h-4 w-4 mr-2 text-blue-600" />
                      <span>{labels.checkOutLabel}</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
