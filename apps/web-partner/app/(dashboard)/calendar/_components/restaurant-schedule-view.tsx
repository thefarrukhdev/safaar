"use client";

import {
  ArrowLeft,
  ArrowRight,
  Calendar as CalendarIcon,
  CalendarCheck2,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Info,
  Lock,
  Plus,
  RefreshCw,
  Search,
  UtensilsCrossed,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import { BookingStatus } from "@safaar/types";
import { toast } from "sonner";
import { Button } from "../../../_components/ui/button";
import { Card, CardBody } from "../../../_components/ui/card";
import { EmptyState, ErrorState } from "../../../_components/ui/empty-state";
import { Input } from "../../../_components/ui/input";
import { PageHeader } from "../../../_components/layout/page-header";
import { StatCard } from "../../../_components/ui/stat-card";
import { Skeleton } from "../../../_components/ui/skeleton";
import { Tooltip } from "../../../_components/ui/tooltip";
import { WalkInDialog, type WalkInInitial } from "../../../_components/domain/walk-in-dialog";
import { BlackoutDialog } from "../../../_components/domain/blackout-dialog";
import { ReservationQuickDrawer } from "../../reservations/reservation-quick-drawer";
import { useRooms } from "../../../_hooks/use-rooms";
import {
  useReservations,
  useConfirmReservation,
  useRejectReservation,
  useCheckIn,
  useCheckOut,
} from "../../../_hooks/use-reservations";
import { useRoomTypes } from "../../../_hooks/use-room-types";
import { useListing } from "../../../_hooks/use-listing";
import { useAuthStore } from "../../../_stores/auth-store";
import { cn } from "../../../_lib/utils/cn";
import { formatMoney } from "../../../_lib/utils/format";
import { TODAY_ISO, addDays, dayDiff, toDateOnly } from "../../../_lib/utils/date";
import { getPartnerLabels } from "../../../_lib/utils/partner-labels";
import {
  DEFAULT_SLOT_DURATION_MINUTES,
  SLOT_STEP_MINUTES,
  buildTimeSlots,
  toHHMM,
  toMinutes,
} from "../../../_lib/utils/time-slots";
import type { ReservationView } from "../../../_lib/domain/types";
import { ReservationBar } from "./reservation-bar";

interface TableRow {
  key: string;
  roomTypeId: string;
  primaryLabel: string;
  secondaryLabel: string;
  isListed: boolean;
  nightlyPrice?: number;
  roomNumber: string;
}

/** Restoran uchun kunlik stollar va vaqt-slotlar jadvali */
export function RestaurantScheduleView() {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);

  const {
    data: rooms = [],
    isLoading: roomsLoading,
    isError: roomsError,
    refetch: refetchRooms,
  } = useRooms();

  const {
    data: reservations = [],
    isLoading: reservationsLoading,
    isError: reservationsError,
    refetch: refetchReservations,
  } = useReservations();

  const { data: roomTypes = [] } = useRoomTypes();
  const { data: listing, isLoading: listingLoading } = useListing();

  const confirmReservation = useConfirmReservation();
  const rejectReservation = useRejectReservation();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const [selectedReservationForDrawer, setSelectedReservationForDrawer] =
    useState<ReservationView | null>(null);

  const [dayOffset, setDayOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInInitial, setWalkInInitial] = useState<WalkInInitial>({});
  const [blackoutOpen, setBlackoutOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scheduleDate = addDays(TODAY_ISO, dayOffset);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([refetchRooms(), refetchReservations()]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleScrollLeft = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: -300, behavior: "smooth" });
    }
  };

  const handleScrollRight = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({ left: 300, behavior: "smooth" });
    }
  };

  const slots = useMemo(() => {
    return buildTimeSlots(listing?.checkInTime, listing?.checkOutTime);
  }, [listing?.checkInTime, listing?.checkOutTime]);

  const spanSlots = Math.max(1, Math.round(DEFAULT_SLOT_DURATION_MINUTES / SLOT_STEP_MINUTES));

  // Hozirgi vaqt sloti (agar bugun tanlangan bo'lsa)
  const nowSlotTime = useMemo(() => {
    if (scheduleDate !== TODAY_ISO) return null;
    const now = new Date();
    const curMin = now.getHours() * 60 + now.getMinutes();
    return (
      slots.find((s) => {
        const min = toMinutes(s);
        return curMin >= min && curMin < min + SLOT_STEP_MINUTES;
      }) ?? null
    );
  }, [scheduleDate, slots]);

  const allRows = useMemo<TableRow[]>(
    () =>
      rooms.map((room) => ({
        key: room.id,
        roomTypeId: room.roomTypeId,
        primaryLabel: room.number,
        secondaryLabel: room.roomTypeName,
        isListed: room.isListed,
        nightlyPrice: room.nightlyPrice,
        roomNumber: room.number,
      })),
    [rooms],
  );

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (typeFilter !== "all" && r.roomTypeId !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = r.roomNumber.toLowerCase().includes(q);
        const matchType = r.secondaryLabel.toLowerCase().includes(q);
        if (!matchNumber && !matchType) return false;
      }
      return true;
    });
  }, [allRows, typeFilter, searchQuery]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort(
      (a, b) =>
        a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: "base" }) ||
        a.primaryLabel.localeCompare(b.primaryLabel),
    );
  }, [filteredRows]);

  const handleEmptyClick = (row: TableRow, slotTime: string) => {
    setWalkInInitial({
      checkIn: scheduleDate,
      checkOut: scheduleDate,
      roomTypeId: row.roomTypeId,
      roomNumber: row.roomNumber,
      slotTime,
    });
    setWalkInOpen(true);
  };

  // Har bir stol uchun shu kungi bronlar
  const reservationsByRow = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        reservation: ReservationView;
        startCol: number;
        spanCols: number;
        truncatedStart: boolean;
        truncatedEnd: boolean;
      }>
    >();

    for (const row of sortedRows) {
      for (const r of reservations) {
        if (
          r.status === BookingStatus.CANCELLED ||
          r.status === BookingStatus.EXPIRED ||
          r.bedId ||
          r.roomNumber !== row.roomNumber ||
          toDateOnly(r.checkIn) !== scheduleDate ||
          !r.slotTime
        ) {
          continue;
        }

        const normSlot = r.slotTime.slice(0, 5);
        let slotIdx = slots.indexOf(normSlot);
        if (slotIdx === -1) {
          const rMin = toMinutes(normSlot);
          let minDiff = Infinity;
          for (let i = 0; i < slots.length; i++) {
            const sMin = toMinutes(slots[i]);
            const diff = Math.abs(rMin - sMin);
            if (diff < minDiff) {
              minDiff = diff;
              slotIdx = i;
            }
          }
        }
        if (slotIdx === -1) continue;

        const visibleStart = slotIdx;
        const visibleEnd = Math.min(slots.length, slotIdx + spanSlots);
        if (visibleEnd <= visibleStart) continue;

        const entry = {
          reservation: r,
          startCol: visibleStart + 2, // +1 sticky ustun + 1 (1-indexed grid)
          spanCols: visibleEnd - visibleStart,
          truncatedStart: false,
          truncatedEnd: slotIdx + spanSlots > slots.length,
        };

        const existing = map.get(row.key) ?? [];
        existing.push(entry);
        map.set(row.key, existing);
      }
    }
    return map;
  }, [sortedRows, reservations, scheduleDate, slots, spanSlots]);

  const dayStats = useMemo(() => {
    const tableNumbers = new Set(sortedRows.map((r) => r.roomNumber));
    const visible = reservations.filter(
      (r) =>
        toDateOnly(r.checkIn) === scheduleDate &&
        r.slotTime &&
        r.status !== BookingStatus.CANCELLED &&
        r.status !== BookingStatus.EXPIRED &&
        tableNumbers.has(r.roomNumber ?? ""),
    );
    const total = visible.reduce((sum, r) => sum + r.totalPrice, 0);
    const paid = visible.reduce((sum, r) => sum + r.paidAmount, 0);
    return {
      bookings: visible.length,
      total,
      paid,
      balance: Math.max(0, total - paid),
      listedRows: sortedRows.filter((r) => r.isListed).length,
    };
  }, [reservations, scheduleDate, sortedRows]);

  const dateLabel = useMemo(() => {
    const [y, m, dNum] = scheduleDate.split("-").map(Number);
    const d = new Date(y, m - 1, dNum);
    const months = [
      "Yanvar", "Fevral", "Mart", "Aprel", "May", "Iyun",
      "Iyul", "Avgust", "Sentabr", "Oktabr", "Noyabr", "Dekabr",
    ];
    const weekdays = ["Yakshanba", "Dushanba", "Seshanba", "Chorshanba", "Payshanba", "Juma", "Shanba"];
    return `${weekdays[d.getDay()]}, ${dNum} ${months[m - 1]}`;
  }, [scheduleDate]);

  const colWidth = 76;
  const roomColWidth = 168;
  const rowHeight = 60;
  const headerHeight = 58;

  const isLoading = roomsLoading || reservationsLoading || listingLoading;
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
          title="Restoran jadvalini yuklashda xatolik yuz berdi"
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
      {/* Sarlavha va harakatlar */}
      <PageHeader
        eyebrow="Operatsion"
        title={labels.calendarTitle}
        description={labels.calendarDescription}
        actions={
          <div className="flex items-center gap-2">
            <Tooltip content="Jadvalni yangilash">
              <Button
                variant="outline"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                aria-label="Ma'lumotlarni yangilash"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isRefreshing ? "animate-spin text-brand-600" : ""}`}
                  aria-hidden="true"
                />
              </Button>
            </Tooltip>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBlackoutOpen(true)}
              className="hidden sm:inline-flex"
            >
              <Lock className="h-4 w-4 mr-1.5" aria-hidden="true" />
              Stolni yopish
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setWalkInInitial({ checkIn: scheduleDate, checkOut: scheduleDate });
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
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Restoran kunlik statistikasi">
        <StatCard
          label={labels.availabilityLabel}
          value={`${dayStats.listedRows} / ${sortedRows.length}`}
          hint="turistlarga sotuvda ochiq"
          icon={<UtensilsCrossed className="h-5 w-5" aria-hidden="true" />}
          tone="brand"
          isLoading={isLoading}
        />
        <StatCard
          label="Bugungi buyurtmalar"
          value={dayStats.bookings.toString()}
          hint={dateLabel}
          icon={<CalendarCheck2 className="h-5 w-5" aria-hidden="true" />}
          tone="emerald"
          isLoading={isLoading}
        />
        <StatCard
          label="Oldindan to'langan"
          value={formatMoney(dayStats.paid)}
          hint={`Jami tushum: ${formatMoney(dayStats.total)}`}
          icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
          tone="blue"
          isLoading={isLoading}
        />
        <StatCard
          label="Ochiq ish soatlari"
          value={`${slots[0] ?? "—"} – ${slots.length ? toHHMM(toMinutes(slots[slots.length - 1]) + SLOT_STEP_MINUTES) : "—"}`}
          hint="Sozlamalar → Qoidalar orqali o'zgartiriladi"
          icon={<Clock className="h-5 w-5" aria-hidden="true" />}
          tone="neutral"
          isLoading={isLoading}
        />
      </section>

      {/* Boshqaruv paneli: Sana va filtrlar */}
      <div className="flex flex-col gap-3 rounded-card border border-[var(--border)] bg-[var(--surface)] p-3.5 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Sana navigatsiyasi */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDayOffset((v) => v - 1)}
              aria-label="Oldingi kun"
              className="h-9 w-9"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Button
              variant={dayOffset === 0 ? "secondary" : "outline"}
              size="sm"
              onClick={() => setDayOffset(0)}
              className="h-9 text-xs font-semibold gap-1.5"
            >
              <CalendarDays className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
              Bugun
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setDayOffset((v) => v + 1)}
              aria-label="Keyingi kun"
              className="h-9 w-9"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </Button>

            {/* Direct date jump input */}
            <div className="relative flex items-center">
              <label htmlFor="restaurant-jump-date" className="sr-only">
                Sanaga o'tish
              </label>
              <div className="relative flex items-center">
                <CalendarIcon className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--muted-foreground)]" aria-hidden="true" />
                <input
                  id="restaurant-jump-date"
                  type="date"
                  value={scheduleDate}
                  onChange={(e) => {
                    if (e.target.value) {
                      setDayOffset(dayDiff(e.target.value, TODAY_ISO));
                    }
                  }}
                  className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)]/70 pl-8 pr-2 text-xs font-medium text-[var(--foreground)] transition-colors hover:bg-[var(--surface-muted)] focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600"
                  title="Istalgan sanaga to'g'ridan-to'g'ri o'tish"
                />
              </div>
            </div>

            <span className="ml-1 text-xs font-bold text-brand-800 dark:text-brand-200 bg-brand-50/70 dark:bg-brand-950/40 px-2.5 py-1.5 rounded-lg">
              {dateLabel}
            </span>
          </div>

          {/* Qidiruv va stol turi filtri */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[160px] sm:w-48">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" aria-hidden="true" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Stol raqami..."
                className="h-9 pl-8 pr-8 text-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                  aria-label="Qidiruvni tozalash"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>

            <select
              aria-label={labels.unitTypeLabel}
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-xs font-medium text-[var(--foreground)] focus:border-brand-600 focus:outline-none"
            >
              <option value="all">Barcha {labels.unitTypeLabel.toLowerCase()}lari</option>
              {roomTypes.map((rt) => (
                <option key={rt.id} value={rt.id}>
                  {rt.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--muted-foreground)] px-1">
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="h-3 w-3 rounded-sm bg-brand-500 shadow-xs" aria-hidden="true" />
            Tasdiqlangan
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="h-3 w-3 rounded-sm bg-accent-500 shadow-xs" aria-hidden="true" />
            Band (ichkarida)
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="h-3 w-3 rounded-sm bg-amber-400 shadow-xs" aria-hidden="true" />
            Tasdiq kutmoqda
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium">
            <span className="h-3 w-3 rounded-sm bg-zinc-400 shadow-xs" aria-hidden="true" />
            Yakunlangan
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px]">
          <Info className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" aria-hidden="true" />
          Vaqt katagiga bosib buyurtma yarating, mavjud bron ustiga bosib boshqaring
        </span>
      </div>

      {/* Asosiy vaqt jadvali */}
      {isLoading ? (
        <div className="rounded-card border border-[var(--border)] bg-[var(--surface)] p-6 shadow-xs animate-pulse">
          <div className="flex gap-2 border-b border-[var(--border)] pb-3">
            <Skeleton className="h-10 w-40 shrink-0" />
            {Array.from({ length: 10 }).map((_, i) => (
              <Skeleton key={i} className="h-10 flex-1" />
            ))}
          </div>
          <div className="mt-3 flex flex-col gap-2.5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Skeleton className="h-14 w-40 shrink-0" />
                {Array.from({ length: 10 }).map((_, j) => (
                  <Skeleton key={j} className="h-14 flex-1" />
                ))}
              </div>
            ))}
          </div>
        </div>
      ) : sortedRows.length === 0 ? (
        <Card>
          <CardBody className="py-12">
            {searchQuery.trim() !== "" || typeFilter !== "all" ? (
              <EmptyState
                icon={<UtensilsCrossed className="h-10 w-10 text-[var(--muted-foreground)]" aria-hidden="true" />}
                title="Hech qanday stol topilmadi"
                description="Kiritilgan parametrlar bo'yicha stollar mos kelmadi."
                action={
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery("");
                      setTypeFilter("all");
                    }}
                  >
                    Filtrlarni tozalash
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<UtensilsCrossed className="h-10 w-10 text-[var(--muted-foreground)]" aria-hidden="true" />}
                title={`${labels.unitPlural.charAt(0).toUpperCase()}${labels.unitPlural.slice(1)} topilmadi`}
                description={`Avval ${labels.unitsPageTitle} bo'limidan stollarni qo'shing.`}
                action={
                  <Button size="sm" asChild>
                    <Link href="/rooms">
                      {labels.unitPlural.charAt(0).toUpperCase() + labels.unitPlural.slice(1)} bo'limiga o'tish
                    </Link>
                  </Button>
                }
              />
            )}
          </CardBody>
        </Card>
      ) : (
        <div className="relative rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-xs">
          {/* Scroll yordamchilari */}
          <div className="flex items-center justify-between border-b border-[var(--border)]/60 px-3 py-1.5 text-xs text-[var(--muted-foreground)] bg-[var(--surface-muted)]/30">
            <span className="text-[11px] font-medium">
              Jami: <strong className="text-[var(--foreground)]">{sortedRows.length}</strong> ta {labels.unitPlural.toLowerCase()} · {slots.length} ta vaqt oralig'i
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleScrollLeft}
                aria-label="Chapga surish"
                className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                title="Chapga surish"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleScrollRight}
                aria-label="O'ngga surish"
                className="h-7 w-7 text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                title="O'ngga surish"
              >
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            </div>
          </div>

          <div
            ref={scrollContainerRef}
            className="overflow-x-auto overflow-y-hidden"
            style={{ scrollBehavior: "smooth" }}
          >
            <div
              className="relative"
              style={{
                display: "grid",
                gridTemplateColumns: `${roomColWidth}px repeat(${slots.length}, ${colWidth}px)`,
                gridAutoRows: `${rowHeight}px`,
                width: "max-content",
              }}
            >
              {/* Chap burchak (sticky) */}
              <div
                style={{
                  gridRow: 1,
                  gridColumn: 1,
                  height: headerHeight,
                  position: "sticky",
                  top: 0,
                  left: 0,
                  zIndex: 30,
                }}
                className="flex items-center justify-between border-b border-r border-[var(--border)] bg-[var(--surface-muted)] px-3 text-[11px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]"
              >
                <span>
                  {labels.unitSingular.charAt(0).toUpperCase()}
                  {labels.unitSingular.slice(1)}
                </span>
                <span className="text-[10px] font-semibold text-brand-700 dark:text-brand-300">
                  ({sortedRows.length})
                </span>
              </div>

              {/* Vaqt-slotlar sarlavhalari (sticky) */}
              {slots.map((slot, i) => {
                const isCurrent = slot === nowSlotTime;
                return (
                  <div
                    key={slot}
                    style={{
                      gridRow: 1,
                      gridColumn: i + 2,
                      height: headerHeight,
                      position: "sticky",
                      top: 0,
                      zIndex: 20,
                    }}
                    className={cn(
                      "flex flex-col items-center justify-center border-b border-r border-[var(--border)] text-xs font-semibold transition-colors",
                      isCurrent
                        ? "bg-brand-50 text-brand-900 dark:bg-brand-950/60 dark:text-brand-100 ring-1 ring-inset ring-brand-500"
                        : "bg-[var(--surface-muted)] text-[var(--muted-foreground)]",
                    )}
                  >
                    <span>{slot}</span>
                    {isCurrent && (
                      <span className="text-[9px] font-bold text-brand-600 dark:text-brand-400 leading-none mt-0.5">
                        Hozir
                      </span>
                    )}
                  </div>
                );
              })}

            {/* Stollar qatorlari */}
            {sortedRows.map((row, rIdx) => {
              const gridRow = rIdx + 2;
              const bars = reservationsByRow.get(row.key) ?? [];
              return (
                <RestaurantTableRow
                  key={row.key}
                  primaryLabel={row.primaryLabel}
                  secondaryLabel={row.secondaryLabel}
                  isListed={row.isListed}
                  nightlyPrice={row.nightlyPrice}
                  gridRow={gridRow}
                  slots={slots}
                  bars={bars}
                  onEmptyClick={(slot) => handleEmptyClick(row, slot)}
                  onSelectReservation={setSelectedReservationForDrawer}
                />
              );
            })}
            </div>
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
              toast.success("Buyurtma muvaffaqiyatli tasdiqlandi");
              setSelectedReservationForDrawer((prev) =>
                prev ? { ...prev, status: BookingStatus.CONFIRMED } : null,
              );
            },
          });
        }}
        onCheckIn={(r) => {
          checkIn.mutate(r.id, {
            onSuccess: () => {
              toast.success("Mehmon stolga o'tqazildi (Check-in)");
              setSelectedReservationForDrawer((prev) =>
                prev ? { ...prev, status: "IN_HOUSE" as any } : null,
              );
            },
          });
        }}
        onCheckOut={(r) => {
          checkOut.mutate(r.id, {
            onSuccess: () => {
              toast.success("Buyurtma yakunlandi (Check-out)");
              setSelectedReservationForDrawer((prev) =>
                prev ? { ...prev, status: BookingStatus.COMPLETED } : null,
              );
            },
          });
        }}
        onReject={(r) => {
          rejectReservation.mutate(
            { id: r.id, reason: "Restoran tomonidan bekor qilindi" },
            {
              onSuccess: () => {
                toast.success("Buyurtma bekor qilindi");
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

interface RestaurantTableRowProps {
  primaryLabel: string;
  secondaryLabel: string;
  isListed: boolean;
  nightlyPrice?: number;
  gridRow: number;
  slots: string[];
  bars: Array<{
    reservation: ReservationView;
    startCol: number;
    spanCols: number;
    truncatedStart: boolean;
    truncatedEnd: boolean;
  }>;
  onEmptyClick: (slot: string) => void;
  onSelectReservation: (reservation: ReservationView) => void;
}

function RestaurantTableRow({
  primaryLabel,
  secondaryLabel,
  isListed,
  nightlyPrice,
  gridRow,
  slots,
  bars,
  onEmptyClick,
  onSelectReservation,
}: RestaurantTableRowProps) {
  return (
    <>
      <div
        style={{
          gridRow,
          gridColumn: 1,
          position: "sticky",
          left: 0,
          zIndex: 15,
        }}
        className="flex min-w-0 flex-col items-start justify-center border-b border-r border-[var(--border)] bg-[var(--surface)] px-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]"
      >
        <div className="flex w-full items-center justify-between gap-1.5">
          <span className="font-mono text-sm font-bold leading-none text-[var(--foreground)] truncate">
            {primaryLabel}
          </span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-semibold shrink-0",
              isListed
                ? "bg-accent-50 text-accent-700 dark:bg-accent-950/40 dark:text-accent-300 border border-accent-200/60 dark:border-accent-900/60"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700",
            )}
          >
            {isListed ? "E'londa" : "Yopiq"}
          </span>
        </div>
        <span className="mt-1 flex w-full items-center justify-between gap-1 truncate text-[10px] text-[var(--muted-foreground)]">
          <span className="truncate">{secondaryLabel}</span>
        </span>

      </div>

      {slots.map((slot, i) => (
        <button
          key={slot}
          type="button"
          onClick={() => onEmptyClick(slot)}
          aria-label={`${primaryLabel}, ${slot} uchun buyurtma yaratish`}
          title={`${primaryLabel} · ${slot} (Bo'sh) — buyurtma yaratish uchun bosing`}
          style={{ gridRow, gridColumn: i + 2 }}
          className="group relative border-b border-r border-[var(--border)] transition-colors hover:bg-brand-50/70 dark:hover:bg-brand-900/25 flex items-center justify-center focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500"
        >
          <Plus
            className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400 opacity-0 transition-opacity group-hover:opacity-100"
            aria-hidden="true"
          />
        </button>
      ))}

      {bars.map((b) => (
        <ReservationBar
          key={b.reservation.id}
          reservation={b.reservation}
          gridRow={gridRow}
          startCol={b.startCol}
          spanCols={b.spanCols}
          truncatedStart={b.truncatedStart}
          truncatedEnd={b.truncatedEnd}
          onSelect={onSelectReservation}
        />
      ))}
    </>
  );
}
