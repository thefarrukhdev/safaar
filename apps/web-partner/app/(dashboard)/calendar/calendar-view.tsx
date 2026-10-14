"use client";

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  Plus,
  Lock,
} from "lucide-react";
import { useMemo, useState } from "react";
import { BookingStatus } from "@safaar/types";
import { Button } from "../../_components/ui/button";
import { Card, CardBody } from "../../_components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "../../_components/ui/tabs";
import { EmptyState, ErrorState } from "../../_components/ui/empty-state";
import { Skeleton } from "../../_components/ui/skeleton";
import { Tooltip } from "../../_components/ui/tooltip";
import { WalkInDialog, type WalkInInitial } from "../../_components/domain/walk-in-dialog";
import { BlackoutDialog } from "../../_components/domain/blackout-dialog";
import { toast } from "sonner";
import { PageHeader } from "../../_components/layout/page-header";
import { useBeds } from "../../_hooks/use-beds";
import { useRooms } from "../../_hooks/use-rooms";
import {
  useReservations,
  useConfirmReservation,
  useRejectReservation,
  useCheckIn,
  useCheckOut,
} from "../../_hooks/use-reservations";
import { useRoomTypes } from "../../_hooks/use-room-types";
import { useVehicles } from "../../_hooks/use-vehicles";
import { useAuthStore } from "../../_stores/auth-store";
import { cn } from "../../_lib/utils/cn";
import { formatMoney } from "../../_lib/utils/format";
import { TODAY_ISO } from "../../_lib/utils/date";
import { getPartnerLabels, hasBeds, isDacha, isRestaurant, hasBuses } from "../../_lib/utils/partner-labels";
import type { ReservationView } from "../../_lib/domain/types";
import { ReservationBar } from "./_components/reservation-bar";
import { ReservationQuickDrawer } from "../reservations/reservation-quick-drawer";
import { DachaAvailabilityView } from "./_components/dacha-availability-view";
import { RestaurantScheduleView } from "./_components/restaurant-schedule-view";

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_LABEL = ["Yak", "Du", "Se", "Cho", "Pa", "Ju", "Sha"];
const MONTH_LABEL = [
  "Yan",
  "Fev",
  "Mar",
  "Apr",
  "May",
  "Iyn",
  "Iyl",
  "Avg",
  "Sen",
  "Okt",
  "Noy",
  "Dek",
];

type ViewMode = 7 | 14 | 30;

/** Kalendar qatori — mehmonxona uchun bitta xona, hostel uchun bitta yotoq. */
interface CalendarRow {
  key: string;
  roomTypeId: string;
  primaryLabel: string;
  secondaryLabel: string;
  isListed: boolean;
  nightlyPrice?: number;
  roomNumber: string;
  bedId?: string;
  /** Bu qatorga tegishli bronni aniqlash uchun. */
  matches: (r: ReservationView) => boolean;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function dayDiff(a: string, b: string): number {
  return Math.round(
    (new Date(a).getTime() - new Date(b).getTime()) / DAY_MS,
  );
}

export function CalendarView() {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const isHostel = hasBeds(partnerType);
  const isBus = hasBuses(partnerType);

  const { data: roomsData, isLoading: roomsLoading, isError: roomsError, refetch: refetchRooms } = useRooms();
  const { data: vehicles, isLoading: vehiclesLoading, isError: vehiclesError, refetch: refetchVehicles } = useVehicles();
  const { data: reservations, isLoading: reservationsLoading, isError: reservationsError, refetch: refetchReservations } = useReservations();
  const { data: roomTypes } = useRoomTypes();
  const { data: beds = [] } = useBeds();

  const rooms = useMemo(() => {
    if (isBus) {
      return vehicles.map(v => ({
        id: v.id,
        roomTypeId: v.id,
        number: v.plateNumber || v.name,
        floor: 1,
        roomTypeName: v.name,
        isListed: v.status === 'active',
        nightlyPrice: v.pricePerDay,
      }));
    }
    return roomsData;
  }, [roomsData, vehicles, isBus]);

  const confirmReservation = useConfirmReservation();
  const rejectReservation = useRejectReservation();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const [selectedReservationForDrawer, setSelectedReservationForDrawer] = useState<ReservationView | null>(null);

  const [viewMode, setViewMode] = useState<ViewMode>(14);
  const [startOffset, setStartOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInInitial, setWalkInInitial] = useState<WalkInInitial>({});
  const [blackoutOpen, setBlackoutOpen] = useState(false);

  const isLoading = roomsLoading || reservationsLoading || (isBus && vehiclesLoading);
  const isError = roomsError || reservationsError || (isBus && vehiclesError);

  const startDate = addDays(TODAY_ISO, startOffset);
  const days = useMemo(
    () =>
      Array.from({ length: viewMode }, (_, i) => addDays(startDate, i)),
    [startDate, viewMode],
  );

  // Har bir mehmonxona xonasi (yoki hostel yotog'i) — bitta kalendar qatori
  const allRows = useMemo<CalendarRow[]>(() => {
    if (isHostel) {
      return beds.map((bed) => {
        const room = rooms.find((r) => r.id === bed.roomId);
        return {
          key: bed.id,
          roomTypeId: room?.roomTypeId ?? "",
          primaryLabel: room ? `${room.number} · ${bed.label}` : bed.label,
          secondaryLabel: room?.roomTypeName ?? "",
          isListed: bed.isListed,
          nightlyPrice: bed.nightlyPrice ?? room?.nightlyPrice,
          roomNumber: room?.number ?? "",
          bedId: bed.id,
          matches: (r) => r.bedId === bed.id,
        };
      });
    }
    return rooms.map((room) => ({
      key: room.id,
      roomTypeId: room.roomTypeId,
      primaryLabel: room.number,
      secondaryLabel: room.roomTypeName,
      isListed: room.isListed,
      nightlyPrice: room.nightlyPrice,
      roomNumber: room.number,
      matches: (r) => !r.bedId && r.roomNumber === room.number,
    }));
  }, [isHostel, beds, rooms]);

  const filteredRows = useMemo(() => {
    if (typeFilter === "all") return allRows;
    return allRows.filter((row) => row.roomTypeId === typeFilter);
  }, [allRows, typeFilter]);

  const sortedRows = useMemo(
    () =>
      [...filteredRows].sort(
        (a, b) =>
          a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true, sensitivity: "base" }) ||
          a.primaryLabel.localeCompare(b.primaryLabel, undefined, { numeric: true, sensitivity: "base" }),
      ),
    [filteredRows],
  );

  // Cell o'lchami view mode'ga qarab
  const cellWidth =
    viewMode === 7 ? 110 : viewMode === 14 ? 64 : 38;
  const roomColWidth = 156;
  const rowHeight = 58;
  const headerHeight = 56;

  // Bo'sh katakka klik — yangi bron yaratish
  const handleEmptyClick = (row: CalendarRow, dateIso: string) => {
    setWalkInInitial({
      checkIn: dateIso,
      checkOut: addDays(dateIso, 1),
      roomTypeId: row.roomTypeId,
      roomNumber: row.roomNumber,
      bedId: row.bedId,
      vehicleId: isBus ? row.key : undefined,
    });
    setWalkInOpen(true);
  };

  // Har bir qator uchun joriy oynadagi bronlar
  const reservationsByRow = useMemo(() => {
    const map = new Map<
      string,
      Array<{
        reservation: (typeof reservations)[number];
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
          r.status === BookingStatus.PENDING ||
          !r.roomNumber ||
          !row.matches(r)
        ) {
          continue;
        }

        const ciOffset = dayDiff(r.checkIn, startDate);
        let coOffset = dayDiff(r.checkOut, startDate);
        if (coOffset <= ciOffset) {
          coOffset = ciOffset + 1;
        }

        // Oraliqdan tashqarida bo'lsa — o'tkazib yuborish
        if (coOffset <= 0 || ciOffset >= viewMode) continue;

        const visibleStart = Math.max(0, ciOffset);
        const visibleEnd = Math.min(viewMode, coOffset);
        if (visibleEnd <= visibleStart) continue;

        const entry = {
          reservation: r,
          startCol: visibleStart + 2, // +1 sticky room col + 1 (1-indexed grid)
          spanCols: visibleEnd - visibleStart,
          truncatedStart: ciOffset < 0,
          truncatedEnd: coOffset > viewMode,
        };

        const existing = map.get(row.key) ?? [];
        existing.push(entry);
        map.set(row.key, existing);
      }
    }
    return map;
  }, [sortedRows, reservations, startDate, viewMode]);

  const periodLabel = useMemo(() => {
    const last = addDays(startDate, viewMode - 1);
    const sDate = new Date(startDate);
    const eDate = new Date(last);
    return `${sDate.getDate()} ${MONTH_LABEL[sDate.getMonth()]} → ${eDate.getDate()} ${MONTH_LABEL[eDate.getMonth()]}`;
  }, [startDate, viewMode]);

  const periodStats = useMemo(() => {
    const visible = reservations.filter((r) => {
      if (
        r.status === BookingStatus.CANCELLED ||
        r.status === BookingStatus.EXPIRED ||
        r.status === BookingStatus.PENDING
      ) {
        return false;
      }
      const ciOffset = dayDiff(r.checkIn, startDate);
      let coOffset = dayDiff(r.checkOut, startDate);
      if (coOffset <= ciOffset) {
        coOffset = ciOffset + 1;
      }
      return coOffset > 0 && ciOffset < viewMode;
    });
    const total = visible.reduce((sum, r) => sum + r.totalPrice, 0);
    const paid = visible.reduce((sum, r) => sum + r.paidAmount, 0);
    return {
      bookings: visible.length,
      total,
      paid,
      balance: total - paid,
      listedRows: sortedRows.filter((row) => row.isListed).length,
    };
  }, [reservations, sortedRows, startDate, viewMode]);

  if (isDacha(partnerType)) return <DachaAvailabilityView />;
  if (isRestaurant(partnerType)) return <RestaurantScheduleView />;

  if (isLoading) {
    return <CalendarSkeleton />;
  }

  if (isError) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          eyebrow="Operatsion"
          title={labels.calendarTitle}
          description={labels.calendarDescription}
        />
        <ErrorState
          title="Kalendar ma'lumotlarini yuklashda xatolik yuz berdi"
          description="Internet aloqasini tekshiring yoki qayta urinib ko'ring."
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refetchRooms();
                refetchReservations();
                if (isBus) refetchVehicles();
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
      <PageHeader
        eyebrow="Operatsion"
        title={labels.calendarTitle}
        description={labels.calendarDescription}
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setBlackoutOpen(true)}
            >
              <Lock className="h-4 w-4 mr-1.5" aria-hidden />
              Inventarni yopish
            </Button>
            <Button
              size="sm"
              onClick={() => {
                setWalkInInitial({});
                setWalkInOpen(true);
              }}
            >
              <Plus className="h-4 w-4 mr-1.5" aria-hidden />
              {labels.newBookingLabel}
            </Button>
          </div>
        }
      />

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <CalendarMetric
          label={labels.availabilityLabel}
          value={`${periodStats.listedRows} / ${sortedRows.length}`}
          hint="turistlarga sotuvda"
        />
        <CalendarMetric
          label="Davrdagi bronlar"
          value={periodStats.bookings.toString()}
          hint={periodLabel}
        />
        <CalendarMetric
          label="Oldindan to'langan"
          value={formatMoney(periodStats.paid)}
          hint={`Jami: ${formatMoney(periodStats.total)}`}
        />
        <CalendarMetric
          label="Qoldiq to'lov"
          value={formatMoney(periodStats.balance)}
          hint="kelganda yoki chiqishda olinadi"
          danger={periodStats.balance > 0}
        />
      </section>

      {/* Boshqaruv lentasi */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[var(--border)] bg-[var(--surface)] p-3">
        {/* View mode */}
        <Tabs
          value={String(viewMode)}
          onValueChange={(val) => setViewMode(Number(val) as typeof viewMode)}
          variant="segmented"
        >
          <TabsList aria-label="Ko'rinish davri">
            {([7, 14, 30] as const).map((v) => (
              <TabsTrigger key={v} value={String(v)}>
                {v} kun
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Date navigation */}
        <div className="flex items-center gap-1">
          <Tooltip content="Oldingi davr">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setStartOffset((v) => v - viewMode)}
              aria-label="Oldingi davr"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden />
            </Button>
          </Tooltip>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStartOffset(0)}
            disabled={startOffset === 0}
          >
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Bugun
          </Button>
          <Tooltip content="Keyingi davr">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setStartOffset((v) => v + viewMode)}
              aria-label="Keyingi davr"
            >
              <ChevronRight className="h-4 w-4" aria-hidden />
            </Button>
          </Tooltip>
          <span className="ml-3 text-sm font-medium text-[var(--muted-foreground)]">
            {periodLabel}
          </span>
        </div>

        {/* Xona/dorm turi filtri */}
        <select
          aria-label={labels.unitTypeLabel}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:border-brand-600 focus:outline-none"
        >
          <option value="all">Barcha {labels.unitTypeLabel.toLowerCase()}lari</option>
          {roomTypes.map((rt) => (
            <option key={rt.id} value={rt.id}>
              {rt.name}
            </option>
          ))}
        </select>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-brand-500" aria-hidden />
          Tasdiqlangan
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-accent-500" aria-hidden />
          Band (ichkarida)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-amber-400" aria-hidden />
          Tasdiq kutmoqda
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded-sm bg-zinc-400" aria-hidden />
          Yakunlangan
        </span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px]">
          <Info className="h-3 w-3" aria-hidden />
          Bo'sh katakka bosib bron yarating
        </span>
      </div>

      {/* Asosiy grid */}
      {sortedRows.length === 0 ? (
        <Card>
          <CardBody>
            <EmptyState
              icon={<CalendarDays className="h-10 w-10" aria-hidden />}
              title={`${labels.unitPlural.charAt(0).toUpperCase()}${labels.unitPlural.slice(1)} yo'q`}
              description="Avval Sozlamalar bo'limidan qo'shing."
            />
          </CardBody>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-card border border-[var(--border)] bg-[var(--surface)]">
          <div
            className="relative min-w-full"
            style={{
              display: "grid",
              gridTemplateColumns: `${roomColWidth}px repeat(${viewMode}, ${cellWidth}px)`,
              gridAutoRows: `${rowHeight}px`,
              width: "max-content",
            }}
          >
            {/* Header (sticky top) — bo'sh katak */}
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
              className="flex items-center justify-between border-b border-r border-[var(--border)] bg-[var(--surface-muted)] px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--muted-foreground)] shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:bg-zinc-900"
            >
              <span>
                {labels.unitSingular.charAt(0).toUpperCase()}
                {labels.unitSingular.slice(1)}
              </span>
              <span className="text-[9px] font-normal lowercase opacity-75">
                ({sortedRows.length})
              </span>
            </div>

            {/* Header — kun katakchalari */}
            {days.map((iso, i) => {
              const d = new Date(iso);
              const isToday = iso === TODAY_ISO;
              const dow = d.getDay();
              const isWeekend = dow === 0 || dow === 6;
              return (
                <div
                  key={iso}
                  style={{
                    gridRow: 1,
                    gridColumn: i + 2,
                    height: headerHeight,
                    position: "sticky",
                    top: 0,
                    zIndex: 20,
                  }}
                  className={cn(
                    "flex flex-col items-center justify-center border-b border-r border-[var(--border)] text-[10px] font-medium",
                    isToday
                      ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
                      : "bg-[var(--surface-muted)]",
                    isWeekend && !isToday && "text-zinc-400",
                  )}
                >
                  <span className="uppercase tracking-wide">
                    {WEEKDAY_LABEL[dow]}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 text-sm font-bold leading-none",
                      isToday &&
                        "inline-flex h-6 w-6 items-center justify-center rounded-full bg-brand-700 text-white",
                    )}
                  >
                    {d.getDate()}
                  </span>
                </div>
              );
            })}

            {/* Har bir qator uchun — xona yoki yotoq */}
            {sortedRows.map((row, rIdx) => {
              const gridRow = rIdx + 2;
              const bars = reservationsByRow.get(row.key) ?? [];
              return (
                <RoomRow
                  key={row.key}
                  primaryLabel={row.primaryLabel}
                  secondaryLabel={row.secondaryLabel}
                  isListed={row.isListed}
                  nightlyPrice={row.nightlyPrice}
                  gridRow={gridRow}
                  days={days}
                  cellWidth={cellWidth}
                  bars={bars}
                  onEmptyClick={(dateIso) => handleEmptyClick(row, dateIso)}
                  onSelectReservation={setSelectedReservationForDrawer}
                />
              );
            })}
          </div>
        </div>
      )}

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

      <ReservationQuickDrawer
        reservation={selectedReservationForDrawer}
        open={Boolean(selectedReservationForDrawer)}
        onClose={() => setSelectedReservationForDrawer(null)}
        onConfirm={(r) => {
          confirmReservation.mutate(r.id, {
            onSuccess: () => {
              toast.success("Bron tasdiqlandi");
              setSelectedReservationForDrawer((prev) =>
                prev ? { ...prev, status: BookingStatus.CONFIRMED } : null
              );
            },
          });
        }}
        onCheckIn={(r) => {
          checkIn.mutate(r.id, {
            onSuccess: () => {
              toast.success("Mehmon joylashtirildi (Check-in)");
              setSelectedReservationForDrawer((prev) =>
                prev ? { ...prev, status: "IN_HOUSE" as any } : null
              );
            },
          });
        }}
        onCheckOut={(r) => {
          checkOut.mutate(r.id, {
            onSuccess: () => {
              toast.success("Chiqish amalga oshirildi (Check-out)");
              setSelectedReservationForDrawer((prev) =>
                prev ? { ...prev, status: BookingStatus.COMPLETED } : null
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
            }
          );
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Bitta qator — sticky yorliq ustun + kun katakchalari + bronlar
// ─────────────────────────────────────────────────────────────────────────

interface RoomRowProps {
  primaryLabel: string;
  secondaryLabel: string;
  isListed: boolean;
  nightlyPrice?: number;
  gridRow: number;
  days: string[];
  cellWidth: number;
  bars: Array<{
    reservation: import("../../_lib/domain/types").ReservationView;
    startCol: number;
    spanCols: number;
    truncatedStart: boolean;
    truncatedEnd: boolean;
  }>;
  onEmptyClick: (dateIso: string) => void;
  onSelectReservation?: (reservation: ReservationView) => void;
}

function RoomRow({
  primaryLabel,
  secondaryLabel,
  isListed,
  nightlyPrice,
  gridRow,
  days,
  cellWidth,
  bars,
  onEmptyClick,
  onSelectReservation,
}: RoomRowProps) {
  void cellWidth;
  return (
    <>
      {/* Sticky yorliq ustuni */}
      <div
        style={{
          gridRow,
          gridColumn: 1,
          position: "sticky",
          left: 0,
          zIndex: 15,
        }}
        className="flex min-w-0 flex-col items-start justify-center border-b border-r border-[var(--border)] bg-[var(--surface)] px-3 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)] dark:bg-zinc-900"
      >
        <div className="flex w-full items-center justify-between gap-2">
          <span className="font-mono text-sm font-bold leading-none">
            {primaryLabel}
          </span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-semibold",
              isListed
                ? "bg-accent-50 text-accent-700 dark:bg-accent-950/35 dark:text-accent-200"
                : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800",
            )}
          >
            {isListed ? "E'londa" : "Yopiq"}
          </span>
        </div>
        <span className="mt-1 truncate text-[10px] text-[var(--muted-foreground)]">
          {secondaryLabel}
          {nightlyPrice ? ` · ${formatMoney(nightlyPrice)}` : ""}
        </span>
      </div>

      {/* Kun katakchalari (bo'sh, klikga ochiq) */}
      {days.map((iso, i) => {
        const isToday = iso === TODAY_ISO;
        const dow = new Date(iso).getDay();
        const isWeekend = dow === 0 || dow === 6;
        return (
          <button
            key={iso}
            type="button"
            onClick={() => onEmptyClick(iso)}
            aria-label={`${primaryLabel}, ${iso} uchun bron yaratish`}
            title={`${primaryLabel} · ${iso} (Bo'sh) — yangi bron yaratish uchun bosing`}
            style={{ gridRow, gridColumn: i + 2 }}
            className={cn(
              "group relative flex items-center justify-center border-b border-r border-[var(--border)] transition-colors hover:bg-brand-50/80 dark:hover:bg-brand-900/25",
              isToday && "bg-brand-50/40 dark:bg-brand-950/20",
              isWeekend && !isToday && "bg-[var(--surface-muted)]/60",
            )}
          >
            <Plus className="h-3.5 w-3.5 text-brand-600 opacity-0 transition-all duration-150 group-hover:scale-110 group-hover:opacity-100 dark:text-brand-400" />
          </button>
        );
      })}

      {/* Bron bar'lari — kun katakchalari ustida */}
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

function CalendarSkeleton() {
  return (
    <div className="flex flex-col gap-4 animate-pulse">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-4 w-24 mb-2" />
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-card border border-[var(--border)] bg-[var(--surface)] p-4">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-7 w-28 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between rounded-card border border-[var(--border)] bg-[var(--surface)] p-3">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-8 w-36" />
      </div>

      <div className="overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex gap-2 border-b border-[var(--border)] pb-3">
          <Skeleton className="h-10 w-40 shrink-0" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 flex-1" />
          ))}
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-2 items-center">
              <Skeleton className="h-12 w-40 shrink-0" />
              {Array.from({ length: 8 }).map((_, j) => (
                <Skeleton key={j} className="h-12 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function CalendarMetric({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-card border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-xs font-medium text-[var(--muted-foreground)]">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 truncate text-lg font-semibold",
          danger ? "text-red-600" : "text-[var(--foreground)]",
        )}
      >
        {value}
      </p>
      <p className="mt-0.5 truncate text-[11px] text-[var(--muted-foreground)]">
        {hint}
      </p>
    </div>
  );
}
