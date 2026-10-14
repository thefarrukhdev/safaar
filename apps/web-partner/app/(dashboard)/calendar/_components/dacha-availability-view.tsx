"use client";

import {
  CalendarCheck2,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Home,
  Lock,
  Plus,
  Sun,
  Users,
} from "lucide-react";
import { useMemo, useState } from "react";
import { BookingStatus } from "@safaar/types";
import { toast } from "sonner";
import { Button } from "../../../_components/ui/button";
import { EmptyState, ErrorState } from "../../../_components/ui/empty-state";
import { PageHeader } from "../../../_components/layout/page-header";
import { StatCard } from "../../../_components/ui/stat-card";
import { Skeleton } from "../../../_components/ui/skeleton";
import { WalkInDialog, type WalkInInitial } from "../../../_components/domain/walk-in-dialog";
import { BlackoutDialog } from "../../../_components/domain/blackout-dialog";
import { ReservationQuickDrawer } from "../../reservations/reservation-quick-drawer";
import {
  useReservations,
  useConfirmReservation,
  useRejectReservation,
  useCheckIn,
  useCheckOut,
} from "../../../_hooks/use-reservations";
import { useRooms } from "../../../_hooks/use-rooms";
import { getPartnerLabels } from "../../../_lib/utils/partner-labels";
import { useAuthStore } from "../../../_stores/auth-store";
import { TODAY_ISO } from "../../../_lib/utils/date";
import { formatMoney } from "../../../_lib/utils/format";
import { cn } from "../../../_lib/utils/cn";
import type { ReservationView } from "../../../_lib/domain/types";

const WEEKDAY_SHORT = ["Du", "Se", "Cho", "Pa", "Ju", "Sha", "Yak"];
const MONTH_UZ = [
  "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
  "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
];

function toIso(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/** Dacha uchun oylik qulay bandlik ko'rinishi */
export function DachaAvailabilityView() {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);

  const {
    data: rooms = [],
    isLoading: roomsLoading,
    isError: roomsError,
    refetch: refetchRooms,
  } = useRooms();
  const room = rooms[0] ?? null;

  const {
    data: reservations = [],
    isLoading: reservationsLoading,
    isError: reservationsError,
    refetch: refetchReservations,
  } = useReservations();

  const confirmReservation = useConfirmReservation();
  const rejectReservation = useRejectReservation();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const [selectedReservationForDrawer, setSelectedReservationForDrawer] =
    useState<ReservationView | null>(null);

  // Oylik navigatsiya
  const todayDate = new Date(TODAY_ISO);
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth());

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInInitial, setWalkInInitial] = useState<WalkInInitial>({});
  const [blackoutOpen, setBlackoutOpen] = useState(false);

  const prevMonth = () => {
    if (month === 0) {
      setYear((y) => y - 1);
      setMonth(11);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (month === 11) {
      setYear((y) => y + 1);
      setMonth(0);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const goToday = () => {
    setYear(todayDate.getFullYear());
    setMonth(todayDate.getMonth());
  };

  // Oyning birinchi kuni (Dushanba=0 .. Yakshanba=6)
  const rawFirstDow = new Date(year, month, 1).getDay(); // 0=Yak, 1=Du
  const firstDow = (rawFirstDow + 6) % 7; // Monday-first
  const totalDays = daysInMonth(year, month);

  // Barcha kunlar ISO formatda
  const dayIsos = useMemo(
    () => Array.from({ length: totalDays }, (_, i) => toIso(year, month, i + 1)),
    [year, month, totalDays],
  );

  // Band kunlar va bronlar tahlili
  const activeReservations = useMemo(
    () =>
      reservations.filter(
        (r) =>
          r.status !== BookingStatus.CANCELLED &&
          r.status !== BookingStatus.EXPIRED &&
          r.status !== BookingStatus.PENDING,
      ),
    [reservations],
  );

  const bookedDaysMap = useMemo(() => {
    const map = new Map<string, ReservationView>();
    for (const r of activeReservations) {
      for (let d = r.checkIn; d < r.checkOut; d = addDays(d, 1)) {
        map.set(d, r);
      }
    }
    return map;
  }, [activeReservations]);

  const bookedCount = useMemo(
    () => dayIsos.filter((d) => bookedDaysMap.has(d)).length,
    [dayIsos, bookedDaysMap],
  );

  const freeCount = totalDays - bookedCount;
  const occupancyPercent = totalDays > 0 ? Math.round((bookedCount / totalDays) * 100) : 0;

  // Shu oydagi jami tushum
  const monthRevenue = useMemo(() => {
    const startMonth = toIso(year, month, 1);
    const endMonth = toIso(year, month, totalDays);
    return activeReservations
      .filter((r) => r.checkIn <= endMonth && r.checkOut >= startMonth)
      .reduce((sum, r) => sum + r.totalPrice, 0);
  }, [activeReservations, year, month, totalDays]);

  const handleDayClick = (iso: string) => {
    const existing = bookedDaysMap.get(iso);
    if (existing) {
      setSelectedReservationForDrawer(existing);
      return;
    }
    setWalkInInitial({
      checkIn: iso,
      checkOut: addDays(iso, 1),
      roomTypeId: room?.roomTypeId,
      roomNumber: room?.number,
    });
    setWalkInOpen(true);
  };

  const isCurrentMonth =
    year === todayDate.getFullYear() && month === todayDate.getMonth();

  const isLoading = roomsLoading || reservationsLoading;
  const isError = roomsError || reservationsError;

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          eyebrow="Operatsion"
          title={labels.calendarTitle}
          description={labels.calendarDescription}
        />
        <ErrorState
          title="Dacha kalendarini yuklashda xatolik yuz berdi"
          description="Internet aloqasini tekshiring yoki qayta urinib ko'ring."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchRooms();
                refetchReservations();
              }}
            >
              Qayta urinish
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Sarlavha va Harakatlar */}
      <PageHeader
        eyebrow="Operatsion"
        title={labels.calendarTitle}
        description={labels.calendarDescription}
        actions={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBlackoutOpen(true)}
              className="hidden sm:inline-flex"
            >
              <Lock className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Sanani yopish
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setWalkInInitial({
                  roomTypeId: room?.roomTypeId,
                  roomNumber: room?.number,
                });
                setWalkInOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" aria-hidden="true" />
              {labels.newBookingLabel}
            </Button>
          </div>
        }
      />

      {/* KPI Ko'rsatkichlar */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Dacha oylik statistikasi">
        <StatCard
          label="Bo'sh kunlar"
          value={`${freeCount} kun`}
          hint={`${totalDays - bookedCount} / ${totalDays} kun sotuvga tayyor`}
          icon={<Sun className="h-5 w-5" aria-hidden="true" />}
          tone="emerald"
          isLoading={isLoading}
        />
        <StatCard
          label="Band kunlar"
          value={`${bookedCount} kun`}
          hint={`${occupancyPercent}% oylik bandlik`}
          icon={<CalendarCheck2 className="h-5 w-5" aria-hidden="true" />}
          tone="brand"
          isLoading={isLoading}
        />
        <StatCard
          label="Oylik tushum"
          value={formatMoney(monthRevenue)}
          hint={`${activeReservations.length} ta faol buyurtma`}
          icon={<DollarSign className="h-5 w-5" aria-hidden="true" />}
          tone="blue"
          isLoading={isLoading}
        />
        <StatCard
          label="Faol mehmonlar"
          value={`${activeReservations.reduce((sum, r) => sum + r.adults + r.children, 0)} kishi`}
          hint="Joriy davrdagi barcha mehmonlar"
          icon={<Users className="h-5 w-5" aria-hidden="true" />}
          tone="neutral"
          isLoading={isLoading}
        />
      </section>

      {/* Oy navigatsiyasi va legend */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={prevMonth}
            aria-label="Oldingi oy"
            className="h-9 w-9"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </Button>
          <Button
            variant={isCurrentMonth ? "secondary" : "outline"}
            size="sm"
            onClick={goToday}
            className="h-9 text-xs font-semibold gap-1.5"
          >
            <CalendarDays className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
            Bugun
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={nextMonth}
            aria-label="Keyingi oy"
            className="h-9 w-9"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>

          {/* Oy va yil tezkor tanlash */}
          <div className="flex items-center gap-1.5 ml-1">
            <select
              aria-label="Oy tanlash"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 px-2.5 text-xs font-semibold text-[var(--foreground)] focus:border-brand-600 focus:outline-none"
            >
              {MONTH_UZ.map((mName, idx) => (
                <option key={mName} value={idx}>
                  {mName}
                </option>
              ))}
            </select>
            <select
              aria-label="Yil tanlash"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 px-2.5 text-xs font-semibold text-[var(--foreground)] focus:border-brand-600 focus:outline-none"
            >
              {[year - 1, year, year + 1, year + 2].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3.5 text-xs text-[var(--muted-foreground)]">
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-3 w-3 rounded-sm bg-brand-500 shadow-xs" aria-hidden="true" />
            Band
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-3 w-3 rounded-sm bg-accent-400 shadow-xs" aria-hidden="true" />
            Bo'sh (ochiq)
          </span>
          <span className="flex items-center gap-1.5 font-medium">
            <span className="h-3 w-3 rounded-sm bg-zinc-200 dark:bg-zinc-700 shadow-xs" aria-hidden="true" />
            O'tgan kun
          </span>
        </div>
      </div>

      {/* Asosiy oylik taqvim */}
      {isLoading ? (
        <div className="rounded-card border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs animate-pulse">
          <div className="grid grid-cols-7 gap-2 pb-4 border-b border-[var(--border)]">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
          <div className="grid grid-cols-7 gap-2 pt-4">
            {Array.from({ length: 28 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-md" />
            ))}
          </div>
        </div>
      ) : !room ? (
        <div className="rounded-card border border-[var(--border)] bg-[var(--surface)] p-8">
          <EmptyState
            icon={<Home className="h-10 w-10 text-[var(--muted-foreground)]" aria-hidden="true" />}
            title="Dacha ob'ekti topilmadi"
            description="Bandlik kalendarini ko'rish uchun avval Sozlamalar bo'limidan dachani qo'shing."
          />
        </div>
      ) : (
        <div className="rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-xs overflow-hidden">
          {/* Hafta sarlavhalari (Dushanba - Yakshanba) */}
          <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface-muted)]/60">
            {WEEKDAY_SHORT.map((label, idx) => (
              <div
                key={label}
                className={cn(
                  "py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)]",
                  (idx === 5 || idx === 6) && "text-zinc-400 dark:text-zinc-500",
                )}
              >
                {label}
              </div>
            ))}
          </div>

          {/* Oylik kataklar */}
          <div className="grid grid-cols-7">
            {/* Oy boshidagi bo'sh kataklar */}
            {Array.from({ length: firstDow }, (_, i) => (
              <div
                key={`empty-${i}`}
                className="min-h-[80px] sm:min-h-[96px] border-b border-r border-[var(--border)] bg-[var(--surface-muted)]/30"
              />
            ))}

            {dayIsos.map((iso) => {
              const day = new Date(iso).getDate();
              const dow = new Date(iso).getDay();
              const isToday = iso === TODAY_ISO;
              const reservation = bookedDaysMap.get(iso);
              const isBooked = Boolean(reservation);
              const isWeekend = dow === 0 || dow === 6;
              const isPast = iso < TODAY_ISO;

              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => handleDayClick(iso)}
                  title={
                    isBooked
                      ? `${reservation?.guest.fullName} · Band — tafsilotlarni ko'rish uchun bosing`
                      : isPast
                        ? `${iso} · O'tgan kun`
                        : `${iso} · Bo'sh — bosib yangi bron yarating`
                  }
                  aria-label={`${iso}. ${isBooked ? `Band: ${reservation?.guest.fullName}` : isPast ? "O'tgan kun" : "Bo'sh"}`}
                  className={cn(
                    "group relative flex min-h-[80px] sm:min-h-[96px] flex-col items-start justify-between p-2 sm:p-2.5 text-left transition-all",
                    "border-b border-r border-[var(--border)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                    isBooked
                      ? "cursor-pointer bg-brand-50/70 hover:bg-brand-100/90 dark:bg-brand-950/40 dark:hover:bg-brand-900/50"
                      : isPast
                        ? "cursor-default bg-[var(--surface-muted)]/40 opacity-60 hover:opacity-80"
                        : "cursor-pointer bg-[var(--surface)] hover:bg-accent-50/70 dark:hover:bg-accent-950/20",
                    isWeekend && !isBooked && !isToday && !isPast && "bg-zinc-50/70 dark:bg-zinc-900/20",
                  )}
                >
                  <div className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold leading-none transition-colors",
                        isToday
                          ? "bg-brand-600 text-white shadow-xs"
                          : isBooked
                            ? "text-brand-800 dark:text-brand-200"
                            : "text-[var(--foreground)]",
                      )}
                    >
                      {day}
                    </span>

                    {/* Qo'shish belgisi hover bo'lganda */}
                    {!isBooked && !isPast && (
                      <Plus
                        className="h-3.5 w-3.5 text-accent-600 dark:text-accent-400 opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden="true"
                      />
                    )}
                  </div>

                  {/* Bandlik holati yorlig'i */}
                  {isBooked && reservation ? (
                    <div className="w-full mt-1.5 rounded-md bg-brand-600 text-white px-2 py-1 text-[11px] font-semibold leading-tight shadow-xs truncate">
                      <p className="truncate">{reservation.guest.fullName}</p>
                      <p className="text-[9px] opacity-85 font-normal">
                        {formatMoney(reservation.totalPrice)}
                      </p>
                    </div>
                  ) : !isPast ? (
                    <span className="text-[10px] text-[var(--muted-foreground)] opacity-70 group-hover:opacity-100">
                      Bo'sh
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Tezkor Bron Boshqaruvi Tortmasi (Drawer) */}
      <ReservationQuickDrawer
        reservation={selectedReservationForDrawer}
        open={Boolean(selectedReservationForDrawer)}
        onClose={() => setSelectedReservationForDrawer(null)}
        onConfirm={(r) => {
          confirmReservation.mutate(r.id, {
            onSuccess: () => {
              toast.success("Bron muvaffaqiyatli tasdiqlandi");
              setSelectedReservationForDrawer((prev) =>
                prev ? { ...prev, status: BookingStatus.CONFIRMED } : null,
              );
            },
          });
        }}
        onCheckIn={(r) => {
          checkIn.mutate(r.id, {
            onSuccess: () => {
              toast.success("Mehmon joylashtirildi (Check-in)");
              setSelectedReservationForDrawer((prev) =>
                prev ? { ...prev, status: "IN_HOUSE" as any } : null,
              );
            },
          });
        }}
        onCheckOut={(r) => {
          checkOut.mutate(r.id, {
            onSuccess: () => {
              toast.success("Chiqish amalga oshirildi (Check-out)");
              setSelectedReservationForDrawer((prev) =>
                prev ? { ...prev, status: BookingStatus.COMPLETED } : null,
              );
            },
          });
        }}
        onReject={(r) => {
          rejectReservation.mutate(
            { id: r.id, reason: "Hamkor tomonidan bekor qilindi" },
            {
              onSuccess: () => {
                toast.success("Bron bekor qilindi");
                setSelectedReservationForDrawer(null);
              },
            },
          );
        }}
      />

      <WalkInDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        initialValues={walkInInitial}
      />

      <BlackoutDialog
        open={blackoutOpen}
        onClose={() => setBlackoutOpen(false)}
        hotelId={useAuthStore.getState().user?.organizationId}
      />
    </div>
  );
}
