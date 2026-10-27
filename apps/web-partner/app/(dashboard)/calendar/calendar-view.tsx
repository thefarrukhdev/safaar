"use client";

import { useMemo, useState } from "react";
import { BookingStatus } from "@safaar/types";
import { AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../_components/ui/button";
import { ErrorState } from "../../_components/ui/empty-state";
import { PageHeader } from "../../_components/layout/page-header";
import { WalkInDialog, type WalkInInitial } from "../../_components/domain/walk-in-dialog";
import { BlackoutDialog } from "../../_components/domain/blackout-dialog";
import { CheckInDialog } from "../../_components/domain/check-in-dialog";
import { ReservationQuickDrawer } from "../reservations/reservation-quick-drawer";
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
import { TODAY_ISO, addDays, dayDiff, toDateOnly } from "../../_lib/utils/date";
import {
  getPartnerLabels,
  hasBeds,
  isDacha,
  isRestaurant,
  hasBuses,
} from "../../_lib/utils/partner-labels";
import type { ReservationView } from "../../_lib/domain/types";
import type {
  CalendarPeriodStats,
  CalendarRow,
  CalendarRowBar,
  ViewMode,
} from "./types";
import { CalendarHeader } from "./calendar-header";
import { CalendarStats } from "./calendar-stats";
import { CalendarFilters } from "./calendar-filters";
import { CalendarLegend } from "./calendar-legend";
import { CalendarGrid } from "./calendar-grid";
import { CalendarSkeleton } from "./calendar-skeleton";
import { DachaAvailabilityView } from "./_components/dacha-availability-view";
import { RestaurantScheduleView } from "./_components/restaurant-schedule-view";

const MONTH_LABEL = [
  "Yan", "Fev", "Mar", "Apr", "May", "Iyn",
  "Iyl", "Avg", "Sen", "Okt", "Noy", "Dek",
];

export function CalendarView() {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const isHostel = hasBeds(partnerType);
  const isBus = hasBuses(partnerType);

  const {
    data: roomsData = [],
    isLoading: roomsLoading,
    isError: roomsError,
    refetch: refetchRooms,
  } = useRooms();

  const {
    data: vehicles = [],
    isLoading: vehiclesLoading,
    isError: vehiclesError,
    refetch: refetchVehicles,
  } = useVehicles();

  const {
    data: reservations = [],
    isLoading: reservationsLoading,
    isError: reservationsError,
    refetch: refetchReservations,
  } = useReservations();

  const { data: roomTypes = [] } = useRoomTypes();
  const { data: beds = [] } = useBeds();

  const rooms = useMemo(() => {
    if (isBus) {
      return vehicles.map((v) => ({
        id: v.id,
        roomTypeId: v.id,
        number: v.plateNumber || v.name,
        floor: 1,
        roomTypeName: v.name,
        isListed: v.status === "active",
        nightlyPrice: v.pricePerDay,
        photos: [],
      }));
    }
    return roomsData;
  }, [roomsData, vehicles, isBus]);

  const confirmReservation = useConfirmReservation();
  const rejectReservation = useRejectReservation();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();

  const [selectedReservationForDrawer, setSelectedReservationForDrawer] =
    useState<ReservationView | null>(null);
  const [assignTarget, setAssignTarget] = useState<ReservationView | null>(null);

  // Filtrlar va ko'rinish sozlamalari
  const [viewMode, setViewMode] = useState<ViewMode>(14);
  const [startOffset, setStartOffset] = useState(0);
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "occupied" | "vacant">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInInitial, setWalkInInitial] = useState<WalkInInitial>({});
  const [blackoutOpen, setBlackoutOpen] = useState(false);

  const startDate = addDays(TODAY_ISO, startOffset);
  const days = useMemo(
    () => Array.from({ length: viewMode }, (_, i) => addDays(startDate, i)),
    [startDate, viewMode],
  );

  // Faol bronlar
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

  // Barcha qatorlarni shakllantirish (xona, yotoq yoki transport)
  const allRows = useMemo<CalendarRow[]>(() => {
    if (isHostel) {
      return beds.map((bed) => {
        const room = rooms.find((r) => r.id === bed.roomId);
        const matches = (r: ReservationView) => r.bedId === bed.id;
        const isOccupiedToday = activeReservations.some((r) => {
          const ci = toDateOnly(r.checkIn);
          const co = toDateOnly(r.checkOut);
          return ci <= TODAY_ISO && TODAY_ISO < co && matches(r);
        });

        return {
          key: bed.id,
          roomTypeId: room?.roomTypeId ?? "",
          primaryLabel: room ? `${room.number} · ${bed.label}` : bed.label,
          secondaryLabel: room?.roomTypeName ?? "",
          isListed: bed.isListed,
          nightlyPrice: bed.nightlyPrice ?? room?.nightlyPrice,
          roomNumber: room?.number ?? "",
          bedId: bed.id,
          isOccupiedToday,
          matches,
        };
      });
    }

    return rooms.map((room) => {
      const matches = (r: ReservationView) => !r.bedId && r.roomNumber === room.number;
      const isOccupiedToday = activeReservations.some((r) => {
        const ci = toDateOnly(r.checkIn);
        const co = toDateOnly(r.checkOut);
        return ci <= TODAY_ISO && TODAY_ISO < co && matches(r);
      });

      return {
        key: room.id,
        roomTypeId: room.roomTypeId,
        primaryLabel: room.number,
        secondaryLabel: room.roomTypeName,
        isListed: room.isListed,
        nightlyPrice: room.nightlyPrice,
        roomNumber: room.number,
        floor: room.floor,
        isOccupiedToday,
        matches,
      };
    });
  }, [isHostel, beds, rooms, activeReservations]);

  // Filtrlar tatbiq etilishi
  const filteredRows = useMemo(() => {
    return allRows.filter((row) => {
      // Xona turi filtri
      if (typeFilter !== "all" && row.roomTypeId !== typeFilter) {
        return false;
      }

      // Xona statusi filtri
      if (statusFilter === "occupied" && !row.isOccupiedToday) {
        return false;
      }
      if (statusFilter === "vacant" && row.isOccupiedToday) {
        return false;
      }

      // Matnli qidiruv
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchNumber = row.roomNumber.toLowerCase().includes(q);
        const matchPrimary = row.primaryLabel.toLowerCase().includes(q);
        const matchSecondary = row.secondaryLabel.toLowerCase().includes(q);
        if (!matchNumber && !matchPrimary && !matchSecondary) {
          return false;
        }
      }

      return true;
    });
  }, [allRows, typeFilter, statusFilter, searchQuery]);

  // Saralash
  const sortedRows = useMemo(
    () =>
      [...filteredRows].sort(
        (a, b) =>
          a.roomNumber.localeCompare(b.roomNumber, undefined, {
            numeric: true,
            sensitivity: "base",
          }) ||
          a.primaryLabel.localeCompare(b.primaryLabel, undefined, {
            numeric: true,
            sensitivity: "base",
          }),
      ),
    [filteredRows],
  );

  // Katakchalarni hisoblash va bronlarni xaritaga joylashtirish
  const reservationsByRow = useMemo(() => {
    const map = new Map<string, CalendarRowBar[]>();

    for (const row of sortedRows) {
      for (const r of activeReservations) {
        if (!row.matches(r)) {
          continue;
        }

        const ciOffset = dayDiff(r.checkIn, startDate);
        let coOffset = dayDiff(r.checkOut, startDate);
        if (coOffset <= ciOffset) {
          coOffset = ciOffset + 1;
        }

        // Oraliqdan tashqarida bo'lsa
        if (coOffset <= 0 || ciOffset >= viewMode) continue;

        const visibleStart = Math.max(0, ciOffset);
        const visibleEnd = Math.min(viewMode, coOffset);
        if (visibleEnd <= visibleStart) continue;

        const entry: CalendarRowBar = {
          reservation: r,
          startCol: visibleStart + 2, // +1 sticky ustun + 1 (1-indexed grid)
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
  }, [sortedRows, activeReservations, startDate, viewMode]);

  // Davr sarlavhasi
  const periodLabel = useMemo(() => {
    const last = addDays(startDate, viewMode - 1);
    const [sY, sM, sD] = startDate.split("-").map(Number);
    const [eY, eM, eD] = last.split("-").map(Number);
    const yearDiff = sY !== eY ? ` ${sY}` : "";
    return `${sD} ${MONTH_LABEL[sM - 1]}${yearDiff} → ${eD} ${MONTH_LABEL[eM - 1]} ${eY}`;
  }, [startDate, viewMode]);

  // Davr statistikasi — faqat ko'rinayotgan va filtrlangan qatorlarga tegishli
  const periodStats = useMemo<CalendarPeriodStats>(() => {
    const matchingReservations = activeReservations.filter((r) =>
      sortedRows.some((row) => row.matches(r)),
    );

    const visibleReservations = matchingReservations.filter((r) => {
      const ciOffset = dayDiff(r.checkIn, startDate);
      let coOffset = dayDiff(r.checkOut, startDate);
      if (coOffset <= ciOffset) {
        coOffset = ciOffset + 1;
      }
      return coOffset > 0 && ciOffset < viewMode;
    });

    const total = visibleReservations.reduce((sum, r) => sum + r.totalPrice, 0);
    const paid = visibleReservations.reduce((sum, r) => sum + r.paidAmount, 0);

    // Xona-kechalar bo'yicha bandlik foizi
    let occupiedNights = 0;
    for (const r of visibleReservations) {
      const ciOffset = Math.max(0, dayDiff(r.checkIn, startDate));
      const coOffset = Math.min(viewMode, Math.max(ciOffset + 1, dayDiff(r.checkOut, startDate)));
      if (coOffset > ciOffset) {
        occupiedNights += coOffset - ciOffset;
      }
    }

    const totalRoomNights = sortedRows.length * viewMode;
    const occupancyRate =
      totalRoomNights > 0
        ? Math.min(100, Math.round((occupiedNights / totalRoomNights) * 100))
        : 0;

    return {
      bookings: visibleReservations.length,
      total,
      paid,
      balance: Math.max(0, total - paid),
      listedRows: sortedRows.filter((row) => row.isListed).length,
      totalRows: sortedRows.length,
      occupancyRate,
    };
  }, [activeReservations, sortedRows, startDate, viewMode]);

  // Xona biriktirilmagan faol bronlar
  const unassignedReservations = useMemo(() => {
    return activeReservations.filter((r) => {
      if (isHostel) return !r.bedId;
      return !r.roomNumber;
    });
  }, [activeReservations, isHostel]);

  const visibleUnassigned = useMemo(() => {
    const endPeriodDate = addDays(startDate, viewMode);
    return unassignedReservations.filter((r) => {
      const ci = toDateOnly(r.checkIn);
      const co = toDateOnly(r.checkOut);
      return co > startDate && ci < endPeriodDate;
    });
  }, [unassignedReservations, startDate, viewMode]);

  // Bo'sh katakka klik — Walk-in ochish
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

  // Sanaga to'g'ridan-to'g'ri o'tish
  const handleJumpToDate = (targetIso: string) => {
    const diff = dayDiff(targetIso, TODAY_ISO);
    setStartOffset(diff);
  };

  const hasActiveFilters =
    searchQuery.trim() !== "" || typeFilter !== "all" || statusFilter !== "all";

  const handleResetFilters = () => {
    setSearchQuery("");
    setTypeFilter("all");
    setStatusFilter("all");
  };

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refetchRooms(),
        refetchReservations(),
        isBus ? refetchVehicles() : Promise.resolve(),
      ]);
    } finally {
      setIsRefreshing(false);
    }
  };

  const isLoading = roomsLoading || reservationsLoading || (isBus && vehiclesLoading);
  const isError = roomsError || reservationsError || (isBus && vehiclesError);

  // Sub-view'lar: Dacha va Restoran uchun maxsus ixtisoslashtirilgan taqvimlar
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
            <Button variant="outline" size="sm" onClick={handleRefresh}>
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
      <CalendarHeader
        title={labels.calendarTitle}
        description={labels.calendarDescription}
        newBookingLabel={labels.newBookingLabel}
        isRefreshing={isRefreshing}
        onRefresh={handleRefresh}
        onOpenWalkIn={() => {
          setWalkInInitial({});
          setWalkInOpen(true);
        }}
        onOpenBlackout={() => setBlackoutOpen(true)}
      />

      {/* KPI Ko'rsatkichlar kartalari */}
      <CalendarStats
        stats={periodStats}
        periodLabel={periodLabel}
        availabilityLabel={labels.availabilityLabel}
      />

      {/* Boshqaruv va qulay filtrlar lentasi */}
      <CalendarFilters
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        startOffset={startOffset}
        onPrevPeriod={() => setStartOffset((v) => v - viewMode)}
        onNextPeriod={() => setStartOffset((v) => v + viewMode)}
        onToday={() => setStartOffset(0)}
        startDateIso={startDate}
        onJumpToDate={handleJumpToDate}
        periodLabel={periodLabel}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        roomTypes={roomTypes}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        unitTypeLabel={labels.unitTypeLabel}
        unitPlural={labels.unitPlural}
        unitTypePlural={labels.unitTypePlural}
        unitStatusLabel={labels.unitStatusLabel}
        searchPlaceholder={`${labels.unitSingular} raqami yoki toifasi...`}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
      />

      {/* Xona biriktirilmagan bronlar haqida ogohlantirish */}
      {visibleUnassigned.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3.5 py-2.5 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Tanlangan davrda <strong>{visibleUnassigned.length} ta bronga</strong> {labels.unitSingular.toLowerCase()} biriktirilmagan.
            </span>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-amber-300 bg-white/70 hover:bg-white text-amber-950 dark:border-amber-800 dark:bg-zinc-900 dark:hover:bg-zinc-800 dark:text-amber-100"
            onClick={() => {
              setSelectedReservationForDrawer(visibleUnassigned[0]);
            }}
          >
            Birinchisini biriktirish
          </Button>
        </div>
      )}

      {/* Rangli Legend va Foydalanish bo'yicha maslahatlar */}
      <CalendarLegend />

      {/* Asosiy interaktiv kalendar jadvali */}
      <CalendarGrid
        rows={sortedRows}
        days={days}
        viewMode={viewMode}
        reservationsByRow={reservationsByRow}
        unitSingular={labels.unitSingular}
        unitPlural={labels.unitPlural}
        hasActiveFilters={hasActiveFilters}
        onResetFilters={handleResetFilters}
        onEmptyClick={handleEmptyClick}
        onSelectReservation={setSelectedReservationForDrawer}
      />

      {/* Walk-in (joyida yaratilgan bron) dialogi */}
      <WalkInDialog
        open={walkInOpen}
        onClose={() => setWalkInOpen(false)}
        initialValues={walkInInitial}
      />

      {/* Inventarni yopish (Blackout) dialogi */}
      <BlackoutDialog
        open={blackoutOpen}
        onClose={() => setBlackoutOpen(false)}
        hotelId={useAuthStore.getState().user?.organizationId}
      />

      {/* Xona biriktirish va Check-in dialogi */}
      <CheckInDialog
        open={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        reservation={assignTarget}
        onAssigned={() => {
          if (assignTarget) {
            checkIn.mutate(assignTarget.id, {
              onSuccess: () => {
                toast.success(`${labels.checkInLabel} muvaffaqiyatli qilindi: ${assignTarget.guest.fullName}`);
                refetchReservations();
              },
              onError: (err) => {
                toast.error(err instanceof Error ? err.message : `${labels.checkInLabel} qilishda xatolik yuz berdi`);
                refetchReservations();
              },
            });
          }
          setAssignTarget(null);
        }}
      />

      {/* Tezkor Bron Boshqaruvi Tortmasi (Drawer) */}
      <ReservationQuickDrawer
        reservation={selectedReservationForDrawer}
        open={Boolean(selectedReservationForDrawer)}
        onClose={() => setSelectedReservationForDrawer(null)}
        onAssignRoom={(r) => {
          setSelectedReservationForDrawer(null);
          setAssignTarget(r);
        }}
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
    </div>
  );
}
