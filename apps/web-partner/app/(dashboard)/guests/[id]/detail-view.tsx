"use client";

import {
  ArrowLeft,
  BedDouble,
  Crown,
  Mail,
  MessageSquare,
  Phone,
  Tag,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { BookingStatus } from "@safaar/types";
import { Badge } from "../../../_components/ui/badge";
import { Button } from "../../../_components/ui/button";
import { Skeleton } from "../../../_components/ui/skeleton";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "../../../_components/ui/card";
import { EmptyState } from "../../../_components/ui/empty-state";
import { ReservationStatusBadge } from "../../../_components/domain/reservation-status-badge";
import { SourceBadge } from "../../../_components/domain/source-badge";
import { useGuests } from "../../../_hooks/use-guests";
import { useReservations } from "../../../_hooks/use-reservations";
import { useAuthStore } from "../../../_stores/auth-store";
import { isRestaurant } from "../../../_lib/utils/partner-labels";
import {
  formatDate,
  formatMoney,
  formatPhone,
} from "../../../_lib/utils/format";

export function GuestDetailView({ id }: { id: string }) {
  const { data: guests, isLoading: isGuestsLoading } = useGuests();
  const { data: reservations, isLoading: isReservationsLoading } = useReservations();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const restaurant = isRestaurant(partnerType);
  const UnitIcon = restaurant ? UtensilsCrossed : BedDouble;

  const isLoading = isGuestsLoading || isReservationsLoading;
  const guest = guests.find((g) => g.id === id);

  // Bu mijoz uchun bronlar (guest.id yoki phone bo'yicha)
  const bookings = useMemo(() => {
    if (!guest) return [];
    return reservations
      .filter(
        (r) =>
          r.guest.id === guest.id || r.guest.phone === guest.phone,
      )
      .sort((a, b) => (b.checkIn > a.checkIn ? 1 : -1));
  }, [reservations, guest]);

  // `guest.totalStays`/`totalSpent` mock ma'lumotdagi statik maydonlar —
  // yangi bron qo'shilganda yangilanmaydi. Haqiqiy bronlardan hisoblanadi.
  const stats = useMemo(() => {
    const active = bookings.filter(
      (b) => b.status !== BookingStatus.CANCELLED && b.status !== BookingStatus.EXPIRED,
    );
    return {
      totalStays: active.length,
      totalSpent: active.reduce((sum, b) => sum + b.paidAmount, 0),
    };
  }, [bookings]);

  if (isLoading && !guest) {
    return <GuestDetailSkeleton />;
  }

  if (!guest) {
    return (
      <EmptyState
        title="Mijoz topilmadi"
        description={`ID: ${id}`}
        action={
          <Link href="/guests">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Mijozlar ro'yxatiga
            </Button>
          </Link>
        }
      />
    );
  }

  const initials = guest.fullName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/guests"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Mijozlar ro'yxati
      </Link>

      {/* Hero */}
      <Card>
        <CardBody className="flex flex-wrap items-center gap-5">
          <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-bold text-white shadow-md">
            {initials || "M"}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                {guest.fullName}
              </h1>
              {guest.isVip && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  <Crown className="h-3.5 w-3.5" aria-hidden />
                  VIP
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-3 text-sm text-[var(--muted-foreground)]">
              <a
                href={`tel:+${guest.phone}`}
                className="inline-flex items-center gap-1 hover:text-brand-700 dark:hover:text-brand-300"
              >
                <Phone className="h-3.5 w-3.5" aria-hidden />
                {formatPhone(guest.phone)}
              </a>
              {guest.email && (
                <a
                  href={`mailto:${guest.email}`}
                  className="inline-flex items-center gap-1 hover:text-brand-700 dark:hover:text-brand-300"
                >
                  <Mail className="h-3.5 w-3.5" aria-hidden />
                  {guest.email}
                </a>
              )}
            </div>
            {guest.tags.length > 0 && (
              <div className="mt-1 flex flex-wrap gap-1">
                {guest.tags.map((t) => (
                  <Badge key={t} tone="brand" icon={<Tag className="h-3 w-3" aria-hidden />}>
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <a href={`tel:+${guest.phone}`}>
              <Button variant="outline" size="sm">
                <Phone className="h-4 w-4" aria-hidden />
                Qo'ng'iroq
              </Button>
            </a>
            <Button variant="outline" size="sm">
              <MessageSquare className="h-4 w-4" aria-hidden />
              SMS yuborish
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* KPI'lar */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatBox
          icon={<UnitIcon className="h-4 w-4" aria-hidden />}
          label="Jami tashriflar"
          value={stats.totalStays}
        />
        <StatBox
          icon={<Wallet className="h-4 w-4" aria-hidden />}
          label="Jami sarflagan"
          value={formatMoney(stats.totalSpent)}
        />
        <StatBox
          icon={<Crown className="h-4 w-4" aria-hidden />}
          label="Status"
          value={guest.isVip ? "VIP mijoz" : "Standart"}
        />
      </div>

      {/* Bronlar tarixi */}
      <Card>
        <CardHeader>
          <CardTitle>Bronlar tarixi</CardTitle>
          <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
            {bookings.length} ta bron
          </p>
        </CardHeader>
        <CardBody className="p-0">
          {bookings.length === 0 ? (
            <EmptyState
              icon={<UnitIcon className="h-8 w-8" aria-hidden />}
              title="Bronlar yo'q"
              description="Bu mijoz hozircha bron qilmagan."
            />
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {bookings.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-[var(--surface-muted)]"
                >
                  <Link
                    href={`/reservations/${b.id}`}
                    className="font-mono text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                  >
                    {b.id}
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm font-medium">
                      {b.roomTypeName}
                      {b.roomNumber && (
                        <span className="ml-1 font-mono text-xs text-brand-700 dark:text-brand-300">
                          · {b.roomNumber}
                        </span>
                      )}
                    </span>
                    <span className="text-xs text-[var(--muted-foreground)]">
                      {restaurant
                        ? `${formatDate(b.checkIn)}${b.slotTime ? ` · ${b.slotTime}` : ""}`
                        : `${formatDate(b.checkIn)} → ${formatDate(b.checkOut)} · ${b.nights} kech.`}
                    </span>
                  </div>
                  <SourceBadge source={b.source} />
                  <span className="font-medium">{formatMoney(b.totalPrice)}</span>
                  <ReservationStatusBadge status={b.status} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function StatBox({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
          {icon}
        </span>
        <div className="flex flex-col">
          <span className="text-xs text-[var(--muted-foreground)]">{label}</span>
          <span className="text-lg font-bold tracking-tight">{value}</span>
        </div>
      </CardBody>
    </Card>
  );
}

function GuestDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <Skeleton className="h-4 w-32" />

      {/* Hero Skeleton */}
      <div className="flex flex-wrap items-center gap-5 rounded-2xl border border-zinc-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <Skeleton className="h-8 w-56" />
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28 rounded-lg" />
          <Skeleton className="h-9 w-24 rounded-lg" />
        </div>
      </div>

      {/* Stats Skeleton */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="flex flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-28" />
          </div>
        </div>
      </div>

      {/* Bookings List Skeleton */}
      <div className="rounded-2xl border border-zinc-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
        <Skeleton className="h-6 w-40 mb-4" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between border-b border-zinc-100 py-3 last:border-0 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <Skeleton className="h-8 w-8 rounded-lg" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

