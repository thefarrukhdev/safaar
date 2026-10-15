"use client";

import {
  ArrowLeft,
  BedDouble,
  CalendarCheck,
  CalendarPlus,
  Clock,
  Copy,
  Crown,
  ExternalLink,
  Mail,
  MessageSquare,
  Phone,
  Plus,
  Tag,
  TrendingUp,
  UtensilsCrossed,
  Wallet,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
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
import { WalkInDialog } from "../../../_components/domain/walk-in-dialog";
import { Tabs, TabsList, TabsTrigger } from "../../../_components/ui/tabs";
import { useGuests } from "../../../_hooks/use-guests";
import { useReservations } from "../../../_hooks/use-reservations";
import { useAuthStore } from "../../../_stores/auth-store";
import { isRestaurant, hasBuses } from "../../../_lib/utils/partner-labels";
import {
  formatDate,
  formatMoney,
  formatPhone,
} from "../../../_lib/utils/format";

type TabFilter = "all" | "active" | "completed" | "cancelled";

export function GuestDetailView({ id }: { id: string }) {
  const { data: guests, isLoading: isGuestsLoading } = useGuests();
  const { data: reservations, isLoading: isReservationsLoading } = useReservations();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);
  const UnitIcon = restaurant ? UtensilsCrossed : BedDouble;

  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [walkInOpen, setWalkInOpen] = useState(false);

  const isLoading = isGuestsLoading || isReservationsLoading;
  const guest = guests.find((g) => g.id === id);

  // Bu mijoz uchun barcha bronlar (guest.id yoki phone bo'yicha)
  const bookings = useMemo(() => {
    if (!guest) return [];
    return reservations
      .filter(
        (r) =>
          r.guest.id === guest.id || r.guest.phone === guest.phone,
      )
      .sort((a, b) => (b.checkIn > a.checkIn ? 1 : -1));
  }, [reservations, guest]);

  // Jonli hisoblangan moliyaviy va tashrif statistikasi
  const stats = useMemo(() => {
    const active = bookings.filter(
      (b) => b.status !== BookingStatus.CANCELLED && b.status !== BookingStatus.EXPIRED,
    );
    const rejected = bookings.filter(
      (b) => b.status === BookingStatus.CANCELLED || b.status === BookingStatus.EXPIRED,
    );
    const totalSpent = active.reduce((sum, b) => sum + b.paidAmount, 0);
    const avgBookingValue = active.length > 0 ? Math.round(totalSpent / active.length) : 0;

    return {
      totalStays: active.length,
      totalSpent,
      rejectedCount: rejected.length,
      avgBookingValue,
    };
  }, [bookings]);

  // Tab bo'yicha saralangan bronlar
  const filteredBookings = useMemo(() => {
    switch (activeTab) {
      case "active":
        return bookings.filter(
          (b) =>
            b.status === BookingStatus.CONFIRMED ||
            b.status === BookingStatus.PENDING ||
            (b.status as string) === "IN_HOUSE",
        );
      case "completed":
        return bookings.filter((b) => b.status === BookingStatus.COMPLETED);
      case "cancelled":
        return bookings.filter(
          (b) =>
            b.status === BookingStatus.CANCELLED ||
            b.status === BookingStatus.EXPIRED,
        );
      case "all":
      default:
        return bookings;
    }
  }, [bookings, activeTab]);

  const activeCount = bookings.filter(
    (b) =>
      b.status === BookingStatus.CONFIRMED ||
      b.status === BookingStatus.PENDING ||
      (b.status as string) === "IN_HOUSE",
  ).length;

  const completedCount = bookings.filter((b) => b.status === BookingStatus.COMPLETED).length;
  const cancelledCount = bookings.filter(
    (b) =>
      b.status === BookingStatus.CANCELLED ||
      b.status === BookingStatus.EXPIRED,
  ).length;

  const handleCopyText = async (text: string, successMessage: string) => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success(successMessage);
    } catch {
      toast.error("Nusxalab bo'lmadi");
    }
  };

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
    .toUpperCase() || "M";

  const phoneRaw = guest.phone.trim();
  const telLink = phoneRaw.startsWith("+") ? `tel:${phoneRaw}` : `tel:+${phoneRaw}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Orqaga qaytish havolasi */}
      <div>
        <Link
          href="/guests"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Mijozlar bazasiga qaytish
        </Link>
      </div>

      {/* 1. Mehmon profili sarlavhasi (Hero Card) */}
      <Card>
        <CardBody className="flex flex-wrap items-center justify-between gap-6 p-6">
          <div className="flex flex-wrap items-center gap-5">
            <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-2xl font-bold text-white shadow-md">
              {initials}
            </span>

            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
                  {guest.fullName}
                </h1>
                {guest.isVip && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                    <Crown className="h-3.5 w-3.5 fill-amber-500/20" aria-hidden />
                    VIP Mijoz
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--muted-foreground)]">
                <div className="flex items-center gap-1.5 font-mono">
                  <a
                    href={telLink}
                    className="inline-flex items-center gap-1 hover:text-brand-700 dark:hover:text-brand-300 hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" aria-hidden />
                    {formatPhone(guest.phone)}
                  </a>
                  <button
                    type="button"
                    onClick={() => handleCopyText(guest.phone, "Telefon raqami nusxalandi")}
                    className="rounded p-1 hover:bg-[var(--surface-muted)] hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                    title="Telefon raqamini nusxalash"
                    aria-label="Telefon raqamini nusxalash"
                  >
                    <Copy className="h-3 w-3" />
                  </button>
                </div>

                {guest.email && (
                  <div className="flex items-center gap-1.5">
                    <a
                      href={`mailto:${guest.email}`}
                      className="inline-flex items-center gap-1 hover:text-brand-700 dark:hover:text-brand-300 hover:underline"
                    >
                      <Mail className="h-3.5 w-3.5" aria-hidden />
                      {guest.email}
                    </a>
                    <button
                      type="button"
                      onClick={() => handleCopyText(guest.email!, "Email nusxalandi")}
                      className="rounded p-1 hover:bg-[var(--surface-muted)] hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                      title="Emailni nusxalash"
                      aria-label="Emailni nusxalash"
                    >
                      <Copy className="h-3 w-3" />
                    </button>
                  </div>
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
          </div>

          {/* Tezkor amallar tugmalari */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setWalkInOpen(true)}
              className="gap-1.5"
            >
              <CalendarPlus className="h-4 w-4" aria-hidden />
              <span>Yangi bron yaratish</span>
            </Button>

            <a href={telLink}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Phone className="h-4 w-4" aria-hidden />
                <span>Qo'ng'iroq</span>
              </Button>
            </a>

            <a href={`sms:${phoneRaw}`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                <MessageSquare className="h-4 w-4" aria-hidden />
                <span>SMS yuborish</span>
              </Button>
            </a>
          </div>
        </CardBody>
      </Card>

      {/* 2. Moliyaviy va tashriflar statistikasi */}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatBox
          icon={<UnitIcon className="h-5 w-5" aria-hidden />}
          label={isBus ? "Jami ijaralar" : "Jami tashriflar"}
          value={`${stats.totalStays} marta`}
          hint="Muvaffaqiyatli bronlar soni"
          tone="blue"
        />
        <StatBox
          icon={<Wallet className="h-5 w-5" aria-hidden />}
          label="Jami to'langan summa"
          value={formatMoney(stats.totalSpent)}
          hint="Mijozdan tushgan jami daromad"
          tone="emerald"
        />
        <StatBox
          icon={<TrendingUp className="h-5 w-5" aria-hidden />}
          label="O'rtacha chek"
          value={formatMoney(stats.avgBookingValue)}
          hint="Har bitta tashrif uchun o'rtacha"
          tone="neutral"
        />
        <StatBox
          icon={
            stats.rejectedCount > 0 ? (
              <XCircle className="h-5 w-5" aria-hidden />
            ) : (
              <CalendarCheck className="h-5 w-5" aria-hidden />
            )
          }
          label="Bekor qilingan bronlar"
          value={`${stats.rejectedCount} ta`}
          hint={stats.rejectedCount > 0 ? "Rad etilgan yoki muddati o'tgan" : "Bekor qilingan bronlar yo'q"}
          tone={stats.rejectedCount > 0 ? "rose" : "neutral"}
        />
      </div>

      {/* 3. Bronlar tarixi xronologiyasi (Timeline & Tabs) */}
      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] pb-4">
          <div>
            <CardTitle>Bronlar tarixi</CardTitle>
            <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
              Mijozning ushbu obyektdagi barcha bronlari va xaridlar xronologiyasi
            </p>
          </div>

          <Tabs
            value={activeTab}
            onValueChange={(val) => setActiveTab(val as TabFilter)}
            variant="pills"
          >
            <TabsList>
              <TabsTrigger value="all">
                Barchasi ({bookings.length})
              </TabsTrigger>
              <TabsTrigger value="active">
                Faol ({activeCount})
              </TabsTrigger>
              <TabsTrigger value="completed">
                Tugallangan ({completedCount})
              </TabsTrigger>
              <TabsTrigger value="cancelled">
                Bekor ({cancelledCount})
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardBody className="p-0">
          {filteredBookings.length === 0 ? (
            <div className="py-12">
              <EmptyState
                icon={<Clock className="h-8 w-8 text-zinc-400" aria-hidden />}
                title="Bronlar mavjud emas"
                description={
                  activeTab === "all"
                    ? "Ushbu mehmon hozircha bron qilmagan."
                    : "Tanlangan filtr bo'yicha hech qanday bron topilmadi."
                }
                action={
                  activeTab === "all" ? (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setWalkInOpen(true)}
                      className="gap-1.5"
                    >
                      <Plus className="h-4 w-4" aria-hidden />
                      Ilk bronni yaratish
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActiveTab("all")}
                    >
                      Barcha bronlarni ko'rish
                    </Button>
                  )
                }
              />
            </div>
          ) : (
            <ul className="divide-y divide-[var(--border)]">
              {filteredBookings.map((b) => (
                <li
                  key={b.id}
                  className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 transition-colors hover:bg-[var(--surface-muted)]"
                >
                  <div className="flex items-center gap-4 min-w-[240px] flex-1">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      <UnitIcon className="h-5 w-5" aria-hidden />
                    </span>

                    <div className="flex flex-col gap-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/reservations/${b.id}`}
                          className="font-mono text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                        >
                          {b.id}
                        </Link>
                        <span className="text-sm font-semibold truncate">
                          {b.roomTypeName}
                        </span>
                        {b.roomNumber && (
                          <span className="rounded bg-brand-50 px-1.5 py-0.5 font-mono text-xs font-medium text-brand-700 dark:bg-brand-950/60 dark:text-brand-300">
                            {b.roomNumber}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        <span>
                          {restaurant
                            ? `${formatDate(b.checkIn)}${b.slotTime ? ` · ${b.slotTime}` : ""}`
                            : `${formatDate(b.checkIn)} → ${formatDate(b.checkOut)} · ${b.nights} kecha`}
                        </span>
                        <span>·</span>
                        <SourceBadge source={b.source} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                        {formatMoney(b.totalPrice)}
                      </div>
                      <div className="text-xs text-[var(--muted-foreground)]">
                        To'langan: {formatMoney(b.paidAmount)}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ReservationStatusBadge status={b.status} />

                      <Link href={`/reservations/${b.id}`}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                          title="Bron tafsilotlarini ko'rish"
                          aria-label="Bron tafsilotlari"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* 4. Walk-in Dialog (Prefilled modal) */}
      <WalkInDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        initialValues={{
          fullName: guest.fullName,
          phone: guest.phone,
        }}
      />
    </div>
  );
}

interface StatBoxProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "blue" | "emerald" | "amber" | "rose" | "neutral";
}

function StatBox({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
}: StatBoxProps) {
  const toneClasses = {
    blue: "bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    emerald: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    rose: "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
    neutral: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  }[tone];

  return (
    <Card>
      <CardBody className="flex items-center gap-3.5 p-4">
        <span
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${toneClasses}`}
        >
          {icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-xs font-medium text-[var(--muted-foreground)] truncate">
            {label}
          </span>
          <span className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
            {value}
          </span>
          {hint && (
            <span className="text-[11px] text-[var(--muted-foreground)] truncate">
              {hint}
            </span>
          )}
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
        <Skeleton className="h-20 w-20 rounded-2xl" />
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
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-3.5 rounded-2xl border border-zinc-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900"
          >
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="flex flex-col gap-1.5 flex-1">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Bookings List Skeleton */}
      <div className="rounded-2xl border border-zinc-200/60 bg-white p-6 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900">
        <div className="flex justify-between items-center mb-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-60 rounded-lg" />
        </div>
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center justify-between border-b border-zinc-100 py-4 last:border-0 dark:border-zinc-800"
            >
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-xl" />
                <div className="flex flex-col gap-1.5">
                  <Skeleton className="h-4 w-36" />
                  <Skeleton className="h-3 w-28" />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
