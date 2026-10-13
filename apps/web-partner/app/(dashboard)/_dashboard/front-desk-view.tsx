"use client";

import {
  AlertCircle,
  CalendarDays,
  CalendarPlus,
  Car,
  Home,
  LogIn,
  LogOut,
  Phone,
  Search,
  Zap,
  Users,
  Wallet,
  UtensilsCrossed,
  BedDouble,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import { partners } from "../../_lib/api";
import { Button } from "../../_components/ui/button";
import { Card, CardBody } from "../../_components/ui/card";
import { EmptyState } from "../../_components/ui/empty-state";
import { ConfirmDialog } from "../../_components/ui/dialog";
import { Input } from "../../_components/ui/input";
import { Skeleton } from "../../_components/ui/skeleton";
import { Tooltip } from "../../_components/ui/tooltip";
import { CheckInDialog } from "../../_components/domain/check-in-dialog";
import { OccupancyMeter } from "../../_components/domain/occupancy-meter";
import { SourceBadge } from "../../_components/domain/source-badge";
import { WalkInDialog } from "../../_components/domain/walk-in-dialog";
import { OnboardingWizard } from "../../_components/domain/onboarding-wizard";
import { PageHeader } from "../../_components/layout/page-header";
import { useBeds } from "../../_hooks/use-beds";
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
import { TODAY_ISO } from "../../_lib/utils/date";
import { formatDate, formatMoney } from "../../_lib/utils/format";
import { cn } from "../../_lib/utils/cn";
import { getPartnerLabels, isDacha, isRestaurant } from "../../_lib/utils/partner-labels";
import type { ReservationView } from "../../_lib/domain/types";

// "IN_HOUSE" — backend'da BookingStatus enum'da yo'q, lekin frontend'da qo'llaniladi
const IN_HOUSE = "IN_HOUSE" as const;

const WEEKDAYS = [
  "Yakshanba",
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
];
const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentyabr",
  "oktyabr",
  "noyabr",
  "dekabr",
];

type TaskKind = "pending" | "arrival" | "departure";
type FilterKey = "all" | TaskKind;

interface Task {
  kind: TaskKind;
  reservation: ReservationView;
}

const TASK_ORDER: Record<TaskKind, number> = {
  pending: 0,
  arrival: 1,
  departure: 2,
};

export function FrontDeskView() {
  const router = useRouter();
  const reservations = useReservations();
  const frontDeskStats = useFrontDeskStats();
  const rooms = useDataStore((s) => s.rooms);
  const beds = useDataStore((s) => s.beds);
  const getStats = useDataStore((s) => s.getStats);
  const localStats = useMemo(() => {
    void reservations.data;
    void rooms;
    void beds;
    return getStats();
  }, [getStats, reservations.data, rooms, beds]);
  const user = useAuthStore((s) => s.user);
  const partnerType = user?.partnerType ?? "hotel";
  const labels = getPartnerLabels(partnerType);
  const dacha = isDacha(partnerType);
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const confirmReservation = useConfirmReservation();
  const rejectReservation = useRejectReservation();
  useBeds();

  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const profileQuery = useQuery({
    queryKey: ["partner", "profile"],
    queryFn: () => partners.getProfile(accessToken),
    enabled: Boolean(accessToken),
    staleTime: 60_000,
  });

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [confirmReject, setConfirmReject] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [assignReservation, setAssignReservation] =
    useState<ReservationView | null>(null);

  const tasks: Task[] = useMemo(() => {
    const arr: Task[] = [];
    for (const r of reservations.data) {
      if (r.status === BookingStatus.PENDING) {
        arr.push({ kind: "pending", reservation: r });
      } else if (
        r.checkIn === TODAY_ISO &&
        r.status === BookingStatus.CONFIRMED
      ) {
        arr.push({ kind: "arrival", reservation: r });
      } else if (r.checkOut === TODAY_ISO && r.status === IN_HOUSE) {
        arr.push({ kind: "departure", reservation: r });
      }
    }
    return arr.sort((a, b) => TASK_ORDER[a.kind] - TASK_ORDER[b.kind]);
  }, [reservations.data]);

  const counts = useMemo(() => {
    const c = { all: tasks.length, pending: 0, arrival: 0, departure: 0 };
    for (const task of tasks) c[task.kind]++;
    return c;
  }, [tasks]);

  const stats = useMemo(() => {
    const backend = frontDeskStats.data;
    return {
      occupancyPercent: backend.occupancyPercent || localStats.occupancyPercent,
      occupiedRooms: backend.occupiedRooms || localStats.occupiedRooms,
      totalRooms: backend.totalRooms || localStats.totalRooms,
      arrivalsToday: backend.arrivalsToday || counts.arrival || localStats.arrivalsToday,
      departuresToday: backend.departuresToday || counts.departure || localStats.departuresToday,
      monthRevenue: backend.monthRevenue || localStats.monthRevenue,
    };
  }, [frontDeskStats.data, localStats, counts.arrival, counts.departure]);

  const isStatsLoading = frontDeskStats.isLoading && reservations.isLoading;

  const filtered = useMemo(() => {
    let list =
      filter === "all" ? tasks : tasks.filter((task) => task.kind === filter);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(({ reservation }) =>
        [
          reservation.id,
          reservation.guest.fullName,
          reservation.guest.phone,
          reservation.roomTypeName,
          reservation.roomNumber,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return list;
  }, [filter, query, tasks]);

  const nextTask = tasks[0];

  const handleCheckIn = (reservation: ReservationView) => {
    setAssignReservation(reservation);
  };

  const handleCheckOut = (reservation: ReservationView) => {
    checkOut.mutate(reservation.id, {
      onSuccess: () => {
        toast.success(`${labels.checkOutLabel}: ${reservation.guest.fullName}`);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Xato yuz berdi");
      },
    });
  };

  const handleConfirm = (reservation: ReservationView) => {
    confirmReservation.mutate(reservation.id, {
      onSuccess: () => {
        toast.success(`${labels.reservationLabel} tasdiqlandi: ${reservation.id}`);
      },
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Xato yuz berdi");
      },
    });
  };

  return (
    <div className="flex flex-col gap-6 w-full max-w-[1600px] mx-auto">
      <PageHeader
        eyebrow={labels.dashboardEyebrow}
        title={
          <div className="flex items-center gap-3 mt-1">
            <div className="flex flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950 min-w-[4.25rem] shrink-0">
              <div className="bg-brand-600 px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white">
                {MONTHS[new Date(TODAY_ISO).getMonth()]}
              </div>
              <div className="py-1 text-center text-xl font-black leading-none text-zinc-900 dark:text-white">
                {new Date(TODAY_ISO).getDate()}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-2xl font-bold leading-none text-zinc-900 dark:text-white tracking-tight">
                {WEEKDAYS[new Date(TODAY_ISO).getDay()]}
              </span>
              <span className="text-sm font-medium leading-none text-zinc-500 dark:text-zinc-400">
                {labels.frontDeskDescription}
              </span>
            </div>
          </div>
        }
        description=""
        actions={
          <div className="flex items-center gap-3">
            <Button variant="outline" onClick={() => router.push('/calendar')}>
              <CalendarDays className="mr-2 h-4 w-4" aria-hidden />
              Kalendar
            </Button>
            <Button onClick={() => setWalkInOpen(true)}>
              <CalendarPlus className="mr-2 h-4 w-4" aria-hidden />
              {labels.newBookingLabel}
            </Button>
          </div>
        }
      />
 
      {profileQuery.data?.requiresCompanyDetails && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 dark:border-amber-900/40 dark:bg-amber-950/20 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                Tashkilot bank hisob raqami kiritilmagan
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-400">
                Amallarni to&apos;liq bajarish va mablag&apos;larni yechib olish uchun kompaniya nomi va hisob raqami (20 ta raqam) kiritilishi majburiy.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-200 shrink-0"
            onClick={() => router.push("/settings/hotel")}
          >
            Rekvizitlarni kiritish
          </Button>
        </div>
      )}

      {/* 4 ta Asosiy KPI Kartochkalari */}
      <section aria-label="Asosiy ko'rsatkichlar" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OccupancyCard
          title={
            labels.isDacha
              ? "Dacha bandligi"
              : labels.isRestaurant
                ? "Stollar bandligi"
                : labels.isBus
                  ? "Transport bandligi"
                  : labels.isHostel
                    ? "Yotoqlar bandligi"
                    : "Bandlik ko'rsatkichi"
          }
          percent={stats.occupancyPercent}
          occupied={stats.occupiedRooms}
          total={stats.totalRooms}
          unitLabel={labels.unitPlural}
          icon={
            labels.isRestaurant ? (
              <UtensilsCrossed className="h-5 w-5" />
            ) : labels.isBus ? (
              <Car className="h-5 w-5" />
            ) : labels.isDacha ? (
              <Home className="h-5 w-5" />
            ) : (
              <BedDouble className="h-5 w-5" />
            )
          }
          isLoading={isStatsLoading}
        />

        <MetricCard
          title={
            labels.isRestaurant
              ? "Bugungi bronlar"
              : labels.isBus
                ? "Olib ketishlar"
                : "Bugungi kelishlar"
          }
          value={stats.arrivalsToday}
          subtext={
            labels.isRestaurant
              ? "Bugun keladigan mehmonlar"
              : labels.isBus
                ? "Bugun topshiriladigan avtomobillar"
                : "Bugun kutilayotgan mehmonlar"
          }
          icon={<LogIn className="h-5 w-5" />}
          tone="emerald"
          isLoading={isStatsLoading}
        />

        <MetricCard
          title={
            labels.isRestaurant
              ? "Yakunlangan bronlar"
              : labels.isBus
                ? "Qaytarishlar"
                : "Bugungi ketishlar"
          }
          value={stats.departuresToday}
          subtext={
            labels.isRestaurant
              ? "Bugun yakunlanadigan stollar"
              : labels.isBus
                ? "Bugun qaytariladigan avtomobillar"
                : "Bugun chiqib ketadigan mehmonlar"
          }
          icon={<LogOut className="h-5 w-5" />}
          tone="blue"
          isLoading={isStatsLoading}
        />

        <MetricCard
          title="Oylik tushum"
          value={formatMoney(stats.monthRevenue)}
          subtext="Joriy oy uchun daromad"
          icon={<Wallet className="h-5 w-5" />}
          tone="brand"
          isLoading={isStatsLoading}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        {/* Asosiy vazifalar qismi */}
        <section className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between bg-white dark:bg-zinc-900 p-4 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 shadow-sm">
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-950/50 rounded-lg overflow-x-auto w-full lg:w-auto">
              <FilterTab
                active={filter === "all"}
                count={counts.all}
                onClick={() => setFilter("all")}
                label="Hammasi"
              />
              <FilterTab
                active={filter === "pending"}
                count={counts.pending}
                onClick={() => setFilter("pending")}
                label="Yangi"
              />
              <FilterTab
                active={filter === "arrival"}
                count={counts.arrival}
                onClick={() => setFilter("arrival")}
                label={labels.checkInLabel}
              />
              <FilterTab
                active={filter === "departure"}
                count={counts.departure}
                onClick={() => setFilter("departure")}
                label={labels.checkOutLabel}
              />
            </div>

            <div className="relative shrink-0 lg:w-64">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                aria-hidden
              />
              <Input
                type="search"
                placeholder={`${labels.guestLabel} yoki ID qidirish...`}
                className="h-10 w-full rounded-lg bg-zinc-50 dark:bg-zinc-950/50 pl-9 border-none focus-visible:ring-1 focus-visible:ring-brand-500 transition-shadow"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          {reservations.isLoading ? (
            <div className="flex flex-col gap-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <TaskCardSkeleton key={i} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed border-2 border-zinc-200 dark:border-zinc-800 bg-transparent shadow-none">
              <EmptyState
                icon={<LogOut className="h-10 w-10 text-zinc-300" aria-hidden />}
                title="Hammasi joyida"
                description={
                  query
                    ? "Qidiruv bo'yicha hech narsa topilmadi."
                    : "Hozircha bajarilishi kerak bo'lgan vazifalar yo'q."
                }
              />
            </Card>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map(({ kind, reservation }) => (
                <TaskCard
                  key={`${kind}-${reservation.id}`}
                  kind={kind}
                  reservation={reservation}
                  labels={labels}
                  dacha={dacha}
                  restaurant={isRestaurant(partnerType)}
                  onCheckIn={() => handleCheckIn(reservation)}
                  onCheckOut={() => handleCheckOut(reservation)}
                  onConfirm={() => handleConfirm(reservation)}
                  onReject={() =>
                    setConfirmReject({
                      id: reservation.id,
                      name: reservation.guest.fullName,
                    })
                  }
                />
              ))}
            </div>
          )}
        </section>

        {/* O'ng tomondagi ixcham yordamchi panel */}
        <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <Card className="border-none shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-800/50">
            <CardBody className="p-5 flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-brand-600" aria-hidden />
                <h2 className="text-sm font-semibold">Tezkor vazifa</h2>
              </div>
              {reservations.isLoading ? (
                <div className="rounded-xl border border-zinc-200/60 bg-zinc-50/50 p-4 dark:border-zinc-800/60 dark:bg-zinc-900/50 animate-pulse">
                  <div className="flex items-center gap-2 mb-2">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                  <Skeleton className="h-3 w-40" />
                </div>
              ) : nextTask ? (
                <NextTaskCard task={nextTask} labels={labels} dacha={dacha} restaurant={isRestaurant(partnerType)} />
              ) : (
                <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 p-4 text-center text-sm text-zinc-500">
                  Hozircha shoshilinch vazifa yo'q.
                </div>
              )}
            </CardBody>
          </Card>

          <Card className="border-none shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-800/50 bg-gradient-to-br from-brand-50 to-white dark:from-brand-950/20 dark:to-zinc-950">
            <CardBody className="p-5 flex flex-col gap-3">
              <h2 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 mb-1">Tezkor yo'nalishlar</h2>
              <QuickLink href="/reservations" icon={<Users />} label={labels.reservationsTitle} />
              <QuickLink href="/calendar" icon={<CalendarDays />} label={labels.calendarTitle.split(" ")[0]} />
              <QuickLink href="/rooms" icon={isRestaurant(partnerType) ? <UtensilsCrossed /> : <BedDouble />} label={labels.unitsPageTitle} />
            </CardBody>
          </Card>
        </aside>
      </div>

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
        onConfirm={() => {
          if (!confirmReject) return;
          rejectReservation.mutate(
            { id: confirmReject.id, reason: "partner_rejected" },
            {
              onSuccess: () => {
                toast.success(
                  `${labels.reservationLabel} rad etildi: ${confirmReject.id}`,
                );
              },
              onError: (error) => {
                toast.error(
                  error instanceof Error ? error.message : "Xato yuz berdi",
                );
              },
            },
          );
        }}
        title={`${labels.reservationLabel} rad etilsinmi?`}
        description={
          confirmReject
            ? `${confirmReject.name} ning bronini rad etmoqchimisiz?`
            : ""
        }
        confirmLabel="Rad etish"
        tone="danger"
      />
    </div>
  );
}

// ==========================================
// Helper Components
// ==========================================

import type { PartnerLabels } from "../../_lib/utils/partner-labels";

function FilterTab({
  active,
  count,
  onClick,
  label,
}: {
  active: boolean;
  count: number;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative px-4 py-2 text-sm font-medium transition-all duration-200 rounded-md flex items-center gap-2 whitespace-nowrap",
        active
          ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700/50"
          : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/30 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/30"
      )}
    >
      {label}
      <span className={cn(
        "flex h-5 items-center justify-center rounded-full px-2 text-[11px] font-semibold",
        active ? "bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400" : "bg-zinc-200/50 text-zinc-500 dark:bg-zinc-800"
      )}>
        {count}
      </span>
    </button>
  );
}

const TASK_META: Record<
  TaskKind,
  {
    icon: React.ReactNode;
    iconClass: string;
    bgClass: string;
  }
> = {
  pending: {
    icon: <AlertCircle className="h-5 w-5" aria-hidden />,
    iconClass: "text-amber-600 dark:text-amber-400",
    bgClass: "bg-amber-50 dark:bg-amber-900/30",
  },
  arrival: {
    icon: <LogIn className="h-5 w-5" aria-hidden />,
    iconClass: "text-emerald-600 dark:text-emerald-400",
    bgClass: "bg-emerald-50 dark:bg-emerald-900/30",
  },
  departure: {
    icon: <LogOut className="h-5 w-5" aria-hidden />,
    iconClass: "text-zinc-500 dark:text-zinc-400",
    bgClass: "bg-zinc-100 dark:bg-zinc-800",
  },
};

function TaskCard({
  kind,
  reservation,
  labels,
  dacha,
  restaurant,
  onCheckIn,
  onCheckOut,
  onConfirm,
  onReject,
}: {
  kind: TaskKind;
  reservation: ReservationView;
  labels: PartnerLabels;
  dacha: boolean;
  restaurant?: boolean;
  onCheckIn: () => void;
  onCheckOut: () => void;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const balance = Math.max(0, reservation.totalPrice - reservation.paidAmount);
  const meta = TASK_META[kind];
  const beds = useDataStore((s) => s.beds);
  const bed = reservation.bedId ? beds.find((b) => b.id === reservation.bedId) : undefined;

  const kindLabel =
    kind === "pending"
      ? "Yangi"
      : kind === "arrival"
      ? labels.checkInLabel
      : labels.checkOutLabel;

  return (
    <div className="group relative flex flex-col gap-4 rounded-xl border border-zinc-200/60 bg-white p-4 shadow-sm transition-all duration-200 hover:border-zinc-300 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900 md:flex-row md:items-center">

      {/* Icon Badge */}
      <div className={cn("hidden md:flex h-12 w-12 shrink-0 items-center justify-center rounded-full", meta.bgClass, meta.iconClass)}>
        {meta.icon}
      </div>

      {/* Main Info */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <div className={cn("md:hidden flex h-6 w-6 items-center justify-center rounded-full", meta.bgClass, meta.iconClass)}>
            <span className="[&>svg]:h-3 [&>svg]:w-3">{meta.icon}</span>
          </div>
          <Link href={`/reservations/${reservation.id}`} className="text-base font-semibold text-zinc-900 hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400">
            {reservation.guest.fullName}
          </Link>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {kindLabel}
          </span>
          <SourceBadge source={reservation.source} />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-zinc-500 dark:text-zinc-400">
          {/* Unit type */}
          {!dacha && reservation.roomTypeName && (
            <div className="flex items-center gap-1.5">
              <span className="text-zinc-400">
                {restaurant ? <UtensilsCrossed className="h-4 w-4" /> : <BedDouble className="h-4 w-4" />}
              </span>
              <span>
                {reservation.roomTypeName}
                {reservation.roomNumber && (
                  <strong className="text-zinc-700 dark:text-zinc-300 ml-1">
                    · {reservation.roomNumber}
                    {bed && ` · ${bed.label}`}
                  </strong>
                )}
                {reservation.slotTime && restaurant && (
                  <strong className="text-zinc-700 dark:text-zinc-300 ml-1">
                    · {reservation.slotTime}
                  </strong>
                )}
              </span>
            </div>
          )}
          {/* Duration */}
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-4 w-4 text-zinc-400" />
            <span>
              {restaurant && reservation.slotTime
                ? `${formatDate(reservation.checkIn)} · ${reservation.slotTime}`
                : `${reservation.nights} kecha`}
            </span>
          </div>
          {/* Price & Balance */}
          <div className="flex items-center gap-1.5 font-medium">
            <Wallet className="h-4 w-4 text-zinc-400" />
            {kind === "departure" ? (
              balance > 0 ? (
                <span className="text-red-600 dark:text-red-400">Qarzdorlik: {formatMoney(balance)}</span>
              ) : (
                <span className="text-emerald-600 dark:text-emerald-400">To'liq to'langan ✓</span>
              )
            ) : (
              <span>{formatMoney(reservation.totalPrice)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800/60 md:pt-0 md:border-t-0 md:pl-4 md:border-l">
        <Tooltip content={`${labels.guestLabel}ga qo'ng'iroq`} side="top">
          <a href={`tel:+${reservation.guest.phone}`} className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-zinc-400 hover:text-brand-600 hover:bg-brand-50 transition-colors">
            <Phone className="h-4 w-4" />
          </a>
        </Tooltip>

        <div className="flex-1 flex justify-end gap-2">
          {kind === "pending" && (
            <>
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 border-zinc-200" onClick={onReject}>
                Rad etish
              </Button>
              <Button size="sm" className="bg-brand-600 hover:bg-brand-700 text-white" onClick={onConfirm}>
                Tasdiqlash
              </Button>
            </>
          )}
          {kind === "arrival" && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={onCheckIn}>
              {labels.checkInLabel}
            </Button>
          )}
          {kind === "departure" && (
            <Button variant="outline" size="sm" onClick={onCheckOut} className="border-zinc-200 hover:bg-zinc-50">
              {labels.checkOutLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function NextTaskCard({ task, labels, dacha, restaurant }: { task: Task; labels: PartnerLabels; dacha: boolean; restaurant?: boolean }) {
  const meta = TASK_META[task.kind];
  const beds = useDataStore((s) => s.beds);
  const bed = task.reservation.bedId ? beds.find((b) => b.id === task.reservation.bedId) : undefined;
  const kindLabel =
    task.kind === "pending"
      ? "Yangi"
      : task.kind === "arrival"
      ? labels.checkInLabel
      : labels.checkOutLabel;

  return (
    <Link
      href={`/reservations/${task.reservation.id}`}
      className="group flex flex-col gap-3 rounded-lg border border-zinc-200/60 bg-zinc-50/50 p-4 transition-all duration-200 hover:border-brand-200 hover:bg-brand-50/50 hover:shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900/50 dark:hover:border-brand-900/50 dark:hover:bg-brand-900/20"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("flex h-8 w-8 items-center justify-center rounded-full", meta.bgClass, meta.iconClass)}>
            <span className="[&>svg]:h-4 [&>svg]:w-4">{meta.icon}</span>
          </div>
          <span className="font-semibold text-zinc-900 group-hover:text-brand-600 dark:text-zinc-100 dark:group-hover:text-brand-400">
            {task.reservation.guest.fullName}
          </span>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">
          {kindLabel}
        </span>
      </div>

      {!dacha && task.reservation.roomTypeName && (
        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800">
            {restaurant ? <UtensilsCrossed className="h-3 w-3" /> : <BedDouble className="h-3 w-3" />}
          </div>
          <span className="font-medium">
            {task.reservation.roomTypeName}
            {task.reservation.roomNumber && ` · ${task.reservation.roomNumber}`}
            {bed && ` · ${bed.label}`}
            {restaurant && task.reservation.slotTime && ` · ${task.reservation.slotTime}`}
          </span>
        </div>
      )}
    </Link>
  );
}

function QuickLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-lg border border-transparent px-3 py-2.5 text-sm font-medium text-zinc-600 transition-all hover:bg-white hover:shadow-sm hover:text-brand-700 hover:border-zinc-200/60 dark:text-zinc-400 dark:hover:bg-zinc-900/50"
    >
      <span className="[&>svg]:h-4 [&>svg]:w-4 opacity-70">{icon}</span>
      {label}
    </Link>
  );
}

function OccupancyCard({
  title,
  percent,
  occupied,
  total,
  unitLabel,
  icon,
  isLoading,
}: {
  title: string;
  percent: number;
  occupied: number;
  total: number;
  unitLabel: string;
  icon: React.ReactNode;
  isLoading?: boolean;
}) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900">
      <div>
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              {title}
            </span>
            {isLoading ? (
              <Skeleton className="my-0.5 h-8 w-20" />
            ) : (
              <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {percent}%
              </span>
            )}
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-400">
            {icon}
          </div>
        </div>
        <div className="mt-3">
          <OccupancyMeter percent={percent} className="h-2" />
        </div>
      </div>
      <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        {total > 0 ? (
          <span>
            <strong className="font-semibold text-zinc-700 dark:text-zinc-300">
              {occupied}
            </strong>{" "}
            / {total} {unitLabel} band
          </span>
        ) : (
          <span>{unitLabel} mavjud emas</span>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  subtext,
  icon,
  tone = "brand",
  isLoading,
}: {
  title: string;
  value: string | number;
  subtext: string;
  icon: React.ReactNode;
  tone?: "brand" | "emerald" | "blue" | "amber";
  isLoading?: boolean;
}) {
  const toneClasses = {
    brand: "bg-brand-50 text-brand-600 dark:bg-brand-950/30 dark:text-brand-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30 dark:text-emerald-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/30 dark:text-blue-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/30 dark:text-amber-400",
  }[tone];

  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl border border-zinc-200/60 bg-white p-5 shadow-sm transition-shadow duration-200 hover:shadow-md dark:border-zinc-800/60 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {title}
          </span>
          {isLoading ? (
            <Skeleton className="my-0.5 h-8 w-24" />
          ) : (
            <span className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">
              {value}
            </span>
          )}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl", toneClasses)}>
          {icon}
        </div>
      </div>
      <div className="mt-3 text-xs text-zinc-500 dark:text-zinc-400">
        {subtext}
      </div>
    </div>
  );
}

function TaskCardSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-zinc-200/60 bg-white p-4 shadow-sm dark:border-zinc-800/60 dark:bg-zinc-900 md:flex-row md:items-center animate-pulse">
      <Skeleton className="hidden h-12 w-12 shrink-0 rounded-full md:block" />
      <div className="flex-1 min-w-0 flex flex-col gap-2.5">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
      <div className="flex items-center gap-2 pt-3 md:pt-0">
        <Skeleton className="h-9 w-9 rounded-full" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
    </div>
  );
}

