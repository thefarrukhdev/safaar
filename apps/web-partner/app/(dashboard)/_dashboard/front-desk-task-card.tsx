"use client";

import {
  AlertCircle,
  BedDouble,
  CalendarDays,
  Copy,
  ExternalLink,
  LogIn,
  LogOut,
  MoreVertical,
  Phone,
  UtensilsCrossed,
  Wallet,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "../../_components/ui/button";
import { Badge, type BadgeTone } from "../../_components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../_components/ui/dropdown-menu";
import { Skeleton } from "../../_components/ui/skeleton";
import { Tooltip } from "../../_components/ui/tooltip";
import { SourceBadge } from "../../_components/domain/source-badge";
import { useBeds } from "../../_hooks/use-beds";
import { formatDate, formatMoney } from "../../_lib/utils/format";
import { cn } from "../../_lib/utils/cn";
import type { PartnerLabels } from "../../_lib/utils/partner-labels";
import type { ReservationView } from "../../_lib/domain/types";
import type { TaskKind } from "./types";

interface FrontDeskTaskCardProps {
  kind: TaskKind;
  reservation: ReservationView;
  labels: PartnerLabels;
  dacha: boolean;
  restaurant?: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onViewDetails?: () => void;
}

const TASK_META: Record<
  TaskKind,
  {
    icon: typeof AlertCircle;
    iconClass: string;
    bgClass: string;
    badgeTone: BadgeTone;
  }
> = {
  pending: {
    icon: AlertCircle,
    iconClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-950/40 ring-1 ring-amber-200/60 dark:ring-amber-900/40",
    badgeTone: "amber",
  },
  arrival: {
    icon: LogIn,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/40 ring-1 ring-emerald-200/60 dark:ring-emerald-900/40",
    badgeTone: "emerald",
  },
  departure: {
    icon: LogOut,
    iconClass: "text-blue-600 dark:text-blue-400",
    bgClass: "bg-blue-50 dark:bg-blue-950/40 ring-1 ring-blue-200/60 dark:ring-blue-900/40",
    badgeTone: "blue",
  },
};

export function FrontDeskTaskCard({
  kind,
  reservation,
  labels,
  dacha,
  restaurant,
  onCheckIn,
  onCheckOut,
  onConfirm,
  onReject,
  onViewDetails,
}: FrontDeskTaskCardProps) {
  const balance = Math.max(0, reservation.totalPrice - reservation.paidAmount);
  const meta = TASK_META[kind];
  const IconComponent = meta.icon;
  const { data: beds = [] } = useBeds();
  const bed = reservation.bedId ? beds.find((b) => b.id === reservation.bedId) : undefined;

  const kindLabel =
    kind === "pending"
      ? "Yangi"
      : kind === "arrival"
        ? labels.checkInLabel
        : labels.checkOutLabel;

  // Sanitized phone link
  const rawPhone = reservation.guest.phone ?? "";
  const cleanPhone = rawPhone.replace(/[^\d+]/g, "");
  const telHref = cleanPhone
    ? cleanPhone.startsWith("+")
      ? `tel:${cleanPhone}`
      : `tel:+${cleanPhone}`
    : null;

  const handleCopyPhone = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!rawPhone || rawPhone === "Kiritilmagan") {
      toast.error("Telefon raqami mavjud emas");
      return;
    }
    void navigator.clipboard.writeText(rawPhone).then(() => {
      toast.success("Telefon raqami nusxalandi: " + rawPhone);
    });
  };

  return (
    <article
      aria-label={`${kindLabel} bron: ${reservation.guest.fullName}`}
      className="group relative flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-sm transition-all duration-200 hover:border-[var(--border-strong)] hover:shadow-md md:flex-row md:items-center"
    >
      {/* Icon Badge (Desktop) */}
      <div
        className={cn(
          "hidden md:flex h-12 w-12 shrink-0 items-center justify-center rounded-xl",
          meta.bgClass,
          meta.iconClass,
        )}
        aria-hidden="true"
      >
        <IconComponent className="h-6 w-6" />
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={cn(
              "md:hidden flex h-7 w-7 items-center justify-center rounded-lg",
              meta.bgClass,
              meta.iconClass,
            )}
            aria-hidden="true"
          >
            <IconComponent className="h-4 w-4" />
          </div>

          {onViewDetails ? (
            <button
              type="button"
              onClick={onViewDetails}
              className="text-left text-base font-semibold text-[var(--foreground)] hover:text-brand-600 dark:hover:text-brand-400 transition-colors focus-visible:outline-none focus-visible:underline"
            >
              {reservation.guest.fullName}
            </button>
          ) : (
            <Link
              href={`/reservations/${reservation.id}`}
              className="text-base font-semibold text-[var(--foreground)] hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
            >
              {reservation.guest.fullName}
            </Link>
          )}

          <Badge variant="subtle" tone={meta.badgeTone}>
            {kindLabel}
          </Badge>
          <SourceBadge source={reservation.source} />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs sm:text-sm text-[var(--muted-foreground)]">
          {/* Unit type */}
          {!dacha && reservation.roomTypeName && (
            <div className="flex items-center gap-1.5">
              <span className="text-[var(--muted-foreground)]">
                {restaurant ? (
                  <UtensilsCrossed className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <BedDouble className="h-4 w-4" aria-hidden="true" />
                )}
              </span>
              <span>
                {reservation.roomTypeName}
                {reservation.roomNumber && (
                  <strong className="text-[var(--foreground)] ml-1 font-semibold">
                    · {reservation.roomNumber}
                    {bed && ` · ${bed.label}`}
                  </strong>
                )}
                {reservation.slotTime && restaurant && (
                  <strong className="text-[var(--foreground)] ml-1 font-semibold">
                    · {reservation.slotTime}
                  </strong>
                )}
              </span>
            </div>
          )}

          {/* Duration */}
          <div className="flex items-center gap-1.5">
            <CalendarDays
              className="h-4 w-4 text-[var(--muted-foreground)]"
              aria-hidden="true"
            />
            <span className="tabular-nums">
              {restaurant && reservation.slotTime
                ? `${formatDate(reservation.checkIn)} · ${reservation.slotTime}`
                : `${reservation.nights} ${labels.isBus ? "kun" : restaurant ? "tashrif" : "kecha"} (${formatDate(reservation.checkIn)} - ${formatDate(reservation.checkOut)})`}
            </span>
          </div>

          {/* Price & Balance */}
          <div className="flex items-center gap-1.5 font-medium tabular-nums">
            <Wallet
              className="h-4 w-4 text-[var(--muted-foreground)]"
              aria-hidden="true"
            />
            {kind === "departure" ? (
              balance > 0 ? (
                <span className="text-red-600 dark:text-red-400 font-semibold">
                  Qarzdorlik: {formatMoney(balance)}
                </span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                  To&apos;liq to&apos;langan ✓
                </span>
              )
            ) : (
              <span className="text-[var(--foreground)] font-semibold">
                {formatMoney(reservation.totalPrice)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-[var(--border)] md:pt-0 md:border-t-0 md:pl-4 md:border-l">
        {/* WCAG 44px minimum phone action */}
        {telHref ? (
          <Tooltip content={`${labels.guestLabel}ga qo'ng'iroq`} side="top">
            <a
              href={telHref}
              aria-label={`${reservation.guest.fullName}ga qo'ng'iroq qilish`}
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)] hover:text-brand-600 hover:bg-brand-50 hover:border-brand-200 dark:hover:bg-brand-950/40 dark:hover:border-brand-800 transition-colors border border-[var(--border)] min-h-[44px] min-w-[44px]"
            >
              <Phone className="h-4 w-4" aria-hidden="true" />
            </a>
          </Tooltip>
        ) : (
          <button
            type="button"
            disabled
            aria-label="Telefon raqami ko'rsatilmagan"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[var(--muted-foreground)]/40 border border-[var(--border)] opacity-50 cursor-not-allowed min-h-[44px] min-w-[44px]"
          >
            <Phone className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        <div className="flex-1 flex justify-end items-center gap-2">
          {kind === "pending" && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 dark:text-red-400 dark:hover:bg-red-950/40 min-h-[44px] sm:min-h-[36px]"
                onClick={onReject}
              >
                Rad etish
              </Button>
              <Button
                size="sm"
                className="bg-brand-600 hover:bg-brand-700 text-white min-h-[44px] sm:min-h-[36px]"
                onClick={onConfirm}
              >
                Tasdiqlash
              </Button>
            </>
          )}

          {kind === "arrival" && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm min-h-[44px] sm:min-h-[36px]"
              onClick={onCheckIn}
            >
              <LogIn className="h-4 w-4 mr-1.5" aria-hidden="true" />
              <span>{labels.checkInLabel}</span>
            </Button>
          )}

          {kind === "departure" && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCheckOut}
              className="hover:bg-[var(--surface-muted)] border-[var(--border)] min-h-[44px] sm:min-h-[36px]"
            >
              <LogOut className="h-4 w-4 mr-1.5" aria-hidden="true" />
              <span>{labels.checkOutLabel}</span>
            </Button>
          )}

          {/* Staff Overflow Dropdown Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Qo'shimcha amallar"
                className="h-11 w-11 min-h-[44px] min-w-[44px] text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--surface-muted)] border border-transparent hover:border-[var(--border)]"
              >
                <MoreVertical className="h-4 w-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="bottom" className="w-56">
              <DropdownMenuLabel>Bron amallari</DropdownMenuLabel>
              {onViewDetails ? (
                <DropdownMenuItem onClick={onViewDetails}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  <span>Tezkor ko&apos;rish</span>
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem asChild>
                  <Link href={`/reservations/${reservation.id}`}>
                    <ExternalLink className="h-4 w-4 mr-2" />
                    <span>Batafsil sahifa</span>
                  </Link>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem onClick={handleCopyPhone}>
                <Copy className="h-4 w-4 mr-2" />
                <span>Raqamni nusxalash</span>
              </DropdownMenuItem>

              {telHref && (
                <DropdownMenuItem asChild>
                  <a href={telHref}>
                    <Phone className="h-4 w-4 mr-2" />
                    <span>Qo&apos;ng&apos;iroq qilish</span>
                  </a>
                </DropdownMenuItem>
              )}

              <DropdownMenuSeparator />

              {kind === "arrival" && (
                <DropdownMenuItem onClick={onCheckIn}>
                  <LogIn className="h-4 w-4 mr-2 text-emerald-600" />
                  <span>{labels.checkInLabel}</span>
                </DropdownMenuItem>
              )}

              {kind === "departure" && (
                <DropdownMenuItem onClick={onCheckOut}>
                  <LogOut className="h-4 w-4 mr-2 text-blue-600" />
                  <span>{labels.checkOutLabel}</span>
                </DropdownMenuItem>
              )}

              <DropdownMenuItem destructive onClick={onReject}>
                <XCircle className="h-4 w-4 mr-2 text-red-600" />
                <span>Bekor qilish / Rad etish</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  );
}

export function TaskCardSkeleton() {
  return (
    <div
      aria-hidden="true"
      className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:p-5 shadow-sm md:flex-row md:items-center animate-pulse"
    >
      <Skeleton className="hidden h-12 w-12 shrink-0 rounded-xl md:block" />
      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-3 md:pt-0">
        <Skeleton className="h-11 w-11 rounded-xl" />
        <Skeleton className="h-11 w-28 rounded-xl" />
      </div>
    </div>
  );
}
