"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import { partners } from "../../_lib/api";
import { ConfirmDialog } from "../../_components/ui/dialog";
import { CheckInDialog } from "../../_components/domain/check-in-dialog";
import { WalkInDialog } from "../../_components/domain/walk-in-dialog";
import { OnboardingWizard } from "../../_components/domain/onboarding-wizard";
import { ReservationQuickDrawer } from "../reservations/reservation-quick-drawer";
import { useBeds } from "../../_hooks/use-beds";
import { useRooms } from "../../_hooks/use-rooms";
import { useFrontDeskStats } from "../../_hooks/use-dashboard";
import {
  useCheckIn,
  useCheckOut,
  useConfirmReservation,
  useRejectReservation,
  useReservations,
} from "../../_hooks/use-reservations";
import { useDataStore } from "../../_stores/data-store";
import { useAuthStore } from "../../_stores/auth-store";
import { todayIso } from "../../_lib/utils/date";
import { getPartnerLabels, isDacha, isRestaurant } from "../../_lib/utils/partner-labels";
import type { ReservationView } from "../../_lib/domain/types";
import { FrontDeskHeader } from "./front-desk-header";
import { FrontDeskStats } from "./front-desk-stats";
import { FrontDeskTasks } from "./front-desk-tasks";
import { FrontDeskQuickActions } from "./front-desk-quick-actions";
import type { DateRange, FilterKey, FrontDeskStatsData, Task, TaskKind } from "./types";

// "IN_HOUSE" — backend'da BookingStatus enum'da yo'q, lekin frontend adapter'da faol mehmonlar uchun qo'yiladi
const IN_HOUSE = "IN_HOUSE" as const;

const TASK_ORDER: Record<TaskKind, number> = {
  pending: 0,
  arrival: 1,
  departure: 2,
};

export function FrontDeskView() {
  const reservations = useReservations();
  const frontDeskStats = useFrontDeskStats();
  const { data: rooms = [] } = useRooms();
  const { data: beds = [] } = useBeds();
  const getStats = useDataStore((s) => s.getStats);

  const localStats = useMemo(() => {
    return getStats({ reservations: reservations.data, rooms, beds });
  }, [getStats, reservations.data, rooms, beds]);

  const user = useAuthStore((s) => s.user);
  const partnerType = user?.partnerType ?? "hotel";
  const labels = getPartnerLabels(partnerType);
  const dacha = isDacha(partnerType);
  const restaurant = isRestaurant(partnerType);

  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const confirmReservation = useConfirmReservation();
  const rejectReservation = useRejectReservation();

  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const profileQuery = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => partners.getProfile(accessToken),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });

  // Sana oralig'i (standart: bugun)
  const [dateRange, setDateRange] = useState<DateRange>(() => ({
    startDate: todayIso(),
    endDate: todayIso(),
  }));

  const currentToday = todayIso();
  const isCustomDateRange =
    dateRange.startDate !== currentToday || dateRange.endDate !== currentToday;

  // Dialog & Interaction State
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [confirmReject, setConfirmReject] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [assignReservation, setAssignReservation] =
    useState<ReservationView | null>(null);
  const [drawerReservation, setDrawerReservation] =
    useState<ReservationView | null>(null);

  // Mantiqiy navbatdagi vazifalar
  const tasks: Task[] = useMemo(() => {
    const list: Task[] = [];
    const start = dateRange.startDate;
    const end = dateRange.endDate;

    for (const r of reservations.data) {
      if (r.status === BookingStatus.PENDING) {
        list.push({ kind: "pending", reservation: r });
      } else if (
        r.checkIn >= start &&
        r.checkIn <= end &&
        r.status === BookingStatus.CONFIRMED
      ) {
        list.push({ kind: "arrival", reservation: r });
      } else if (
        r.checkOut >= start &&
        r.checkOut <= end &&
        (r.status === IN_HOUSE || r.status === BookingStatus.CONFIRMED)
      ) {
        list.push({ kind: "departure", reservation: r });
      }
    }
    return list.sort((a, b) => TASK_ORDER[a.kind] - TASK_ORDER[b.kind]);
  }, [reservations.data, dateRange]);

  // Hisoblagichlar
  const counts: Record<FilterKey, number> = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: tasks.length,
      pending: 0,
      arrival: 0,
      departure: 0,
    };
    for (const task of tasks) {
      c[task.kind]++;
    }
    return c;
  }, [tasks]);

  // Statistik ko'rsatkichlar (Backend + fallback local cache)
  const stats: FrontDeskStatsData = useMemo(() => {
    const backend = frontDeskStats.data;
    const totalRooms =
      backend?.totalRooms > 0
        ? backend.totalRooms
        : localStats.totalRooms > 0
          ? localStats.totalRooms
          : rooms.length;
    const occupiedRooms = backend?.occupiedRooms ?? localStats.occupiedRooms;
    const occupancyPercent =
      totalRooms > 0
        ? Math.round((occupiedRooms / totalRooms) * 100)
        : (backend?.occupancyPercent ?? localStats.occupancyPercent ?? 0);
    const arrivalsToday =
      isCustomDateRange
        ? counts.arrival
        : (backend?.arrivalsToday ?? counts.arrival ?? localStats.arrivalsToday);
    const departuresToday = counts.departure;
    const monthRevenue =
      backend?.monthRevenue ?? localStats.monthRevenue ?? 0;

    return {
      occupancyPercent,
      occupiedRooms,
      totalRooms,
      arrivalsToday,
      departuresToday,
      monthRevenue,
    };
  }, [
    frontDeskStats.data,
    localStats,
    rooms.length,
    counts.arrival,
    counts.departure,
    isCustomDateRange,
  ]);

  const isStatsLoading = frontDeskStats.isLoading && reservations.isLoading;

  // Qidiruv va filtr bo'yicha saralangan ro'yxat (raqamlar normalizatsiyasi bilan)
  const filteredTasks = useMemo(() => {
    let list =
      filter === "all" ? tasks : tasks.filter((task) => task.kind === filter);
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      const queryDigits = q.replace(/\D/g, "");
      list = list.filter(({ reservation }) => {
        const guestPhoneDigits = (reservation.guest.phone || "").replace(
          /\D/g,
          "",
        );
        const matchDigits =
          queryDigits.length >= 3 && guestPhoneDigits.includes(queryDigits);
        const textBlock = [
          reservation.id,
          reservation.guest.fullName,
          reservation.guest.phone,
          reservation.roomTypeName,
          reservation.roomNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return matchDigits || textBlock.includes(q);
      });
    }
    return list;
  }, [filter, searchQuery, tasks]);

  const nextTask = tasks[0];

  // Amallar
  const handleCheckIn = (reservation: ReservationView) => {
    setAssignReservation(reservation);
  };

  const handleCheckOut = (reservation: ReservationView) => {
    checkOut.mutate(reservation.id, {
      onSuccess: () => {
        toast.success(`${labels.checkOutLabel}: ${reservation.guest.fullName}`);
        if (drawerReservation?.id === reservation.id) {
          setDrawerReservation(null);
        }
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Xato yuz berdi");
      },
    });
  };

  const handleConfirm = (reservation: ReservationView) => {
    confirmReservation.mutate(reservation.id, {
      onSuccess: () => {
        toast.success(
          `${labels.reservationLabel} tasdiqlandi: #${reservation.id}`,
        );
        if (drawerReservation?.id === reservation.id) {
          setDrawerReservation(null);
        }
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Xato yuz berdi");
      },
    });
  };

  const handleRejectClick = (reservation: ReservationView) => {
    setConfirmReject({
      id: reservation.id,
      name: reservation.guest.fullName,
    });
  };

  const handleConfirmReject = () => {
    if (!confirmReject) return;
    rejectReservation.mutate(
      { id: confirmReject.id, reason: "partner_rejected" },
      {
        onSuccess: () => {
          toast.success(
            `${labels.reservationLabel} rad etildi: #${confirmReject.id}`,
          );
          if (drawerReservation?.id === confirmReject.id) {
            setDrawerReservation(null);
          }
        },
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : "Xato yuz berdi",
          );
        },
      },
    );
  };

  return (
    <div className="flex flex-col gap-6 w-full fade-in">
      {/* 1. Header & Sana & Rekvizitlar ogohlantirish banneri */}
      <FrontDeskHeader
        labels={labels}
        requiresCompanyDetails={profileQuery.data?.requiresCompanyDetails}
        onNewBooking={() => setWalkInOpen(true)}
      />

      {/* 2. Asosiy 4 ta KPI ko'rsatkichi (Occupancy, Arrivals, Departures, Revenue) */}
      <FrontDeskStats
        stats={stats}
        labels={labels}
        isLoading={isStatsLoading}
      />

      {/* 3. Asosiy operatsion qism: Vazifalar ro'yxati va Tezkor yordamchi panel */}
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Chap ustun: Vazifalar, tablar, sana filtri va qidiruv */}
        <FrontDeskTasks
          tasks={tasks}
          filteredTasks={filteredTasks}
          counts={counts}
          filter={filter}
          onFilterChange={setFilter}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          dateRange={dateRange}
          onDateRangeChange={setDateRange}
          isCustomDateRange={isCustomDateRange}
          onResetDateToToday={() =>
            setDateRange({ startDate: todayIso(), endDate: todayIso() })
          }
          isLoading={reservations.isLoading}
          isError={reservations.isError}
          onRetry={() => void reservations.refetch()}
          labels={labels}
          dacha={dacha}
          restaurant={restaurant}
          onCheckIn={handleCheckIn}
          onCheckOut={handleCheckOut}
          onConfirm={handleConfirm}
          onReject={handleRejectClick}
          onViewDetails={(res) => setDrawerReservation(res)}
        />

        {/* O'ng ustun: Shoshilinch vazifa va tezkor yo'nalishlar */}
        <FrontDeskQuickActions
          nextTask={nextTask}
          stats={stats}
          isLoading={reservations.isLoading}
          labels={labels}
          dacha={dacha}
          restaurant={restaurant}
          onViewDetails={(res) => setDrawerReservation(res)}
        />
      </div>

      {/* Slide-over Quick Drawer */}
      <ReservationQuickDrawer
        open={Boolean(drawerReservation)}
        onClose={() => setDrawerReservation(null)}
        reservation={drawerReservation}
        onCheckIn={handleCheckIn}
        onCheckOut={handleCheckOut}
        onConfirm={handleConfirm}
        onReject={handleRejectClick}
      />

      {/* Dialogni boshqarish */}
      <WalkInDialog open={walkInOpen} onClose={() => setWalkInOpen(false)} />
      <OnboardingWizard />

      <CheckInDialog
        open={Boolean(assignReservation)}
        onClose={() => setAssignReservation(null)}
        reservation={assignReservation}
        onAssigned={() => {
          if (assignReservation) {
            checkIn.mutate(assignReservation.id, {
              onSuccess: () => {
                toast.success(
                  `${labels.checkInLabel}: ${assignReservation.guest.fullName}`,
                );
              },
              onError: (error) => {
                toast.error(
                  error instanceof Error ? error.message : "Xato yuz berdi",
                );
              },
            });
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(confirmReject)}
        onClose={() => setConfirmReject(null)}
        onConfirm={handleConfirmReject}
        title={`${labels.reservationLabel} rad etilsinmi?`}
        description={
          confirmReject
            ? `${confirmReject.name} ning bronini rad etmoqchimisiz? Ushbu amal qaytarilmaydi.`
            : ""
        }
        confirmLabel="Rad etish"
        tone="danger"
      />
    </div>
  );
}
