"use client";

import {
  BedDouble,
  CalendarCheck,
  CalendarPlus,
  CalendarRange,
  CarFront,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Download,
  FilterX,
  LayoutGrid,
  List,
  LogOut,
  Search,
  UserPlus,
  UtensilsCrossed,
  Wallet,
  XCircle,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import { Button } from "../../_components/ui/button";
import { Card, CardBody } from "../../_components/ui/card";
import { ConfirmDialog } from "../../_components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "../../_components/ui/tabs";
import { EmptyState, LoadingState, ErrorState } from "../../_components/ui/empty-state";
import { Input } from "../../_components/ui/input";
import { CheckInDialog } from "../../_components/domain/check-in-dialog";
import { ReservationStatusBadge } from "../../_components/domain/reservation-status-badge";
import { SourceBadge } from "../../_components/domain/source-badge";
import { WalkInDialog } from "../../_components/domain/walk-in-dialog";
import { PageHeader } from "../../_components/layout/page-header";
import {
  useReservations,
  useConfirmReservation,
  useRejectReservation,
  useCheckIn,
  useCheckOut,
} from "../../_hooks/use-reservations";
import { useBeds } from "../../_hooks/use-beds";
import { cn } from "../../_lib/utils/cn";
import type { Bed, ReservationUiStatus, ReservationView } from "../../_lib/domain/types";
import { formatDate, formatMoney, formatPhone } from "../../_lib/utils/format";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels, hasBuses, isRestaurant } from "../../_lib/utils/partner-labels";
import { ReservationQuickDrawer } from "./reservation-quick-drawer";
import { ReservationsTable } from "./reservations-table";

type FilterKey = "all" | ReservationUiStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Hammasi" },
  { key: BookingStatus.PENDING, label: "Yangi" },
  { key: BookingStatus.CONFIRMED, label: "Tasdiqlangan" },
  { key: "IN_HOUSE", label: "Yashayapti" },
  { key: BookingStatus.COMPLETED, label: "Yakunlangan" },
  { key: BookingStatus.CANCELLED, label: "Bekor qilingan" },
];

function parseStatusParam(value: string | null): FilterKey {
  if (!value) return "all";
  const upper = value.trim().toUpperCase();
  if (upper === "NEW" || upper === "YANGI") return BookingStatus.PENDING;
  if (upper === "ALL" || upper === "HAMMASI") return "all";
  if (upper === "CANCELED") return BookingStatus.CANCELLED;
  const found = FILTERS.find((f) => f.key.toUpperCase() === upper);
  return found ? found.key : "all";
}

function exportToCsv(items: ReservationView[], unitLabel: string, beds: Bed[], restaurant: boolean) {
  const headers = [
    "ID",
    "Mijoz",
    "Telefon",
    `${unitLabel} turi`,
    unitLabel,
    "Sana",
    ...(restaurant ? ["Vaqt"] : ["Ketish", "Kech."]),
    "Summa",
    "To'langan",
    "Status",
    "Manba",
  ];
  const rows = items.map((r) => {
    const bed = r.bedId ? beds.find((b) => b.id === r.bedId) : undefined;
    return [
      r.id,
      r.guest.fullName,
      `+${r.guest.phone}`,
      r.roomTypeName,
      [r.roomNumber, bed?.label].filter(Boolean).join(" · "),
      r.checkIn,
      ...(restaurant ? [r.slotTime ?? ""] : [r.checkOut, r.nights]),
      r.totalPrice,
      r.paidAmount,
      r.status,
      r.source,
    ];
  });
  const csv = [headers, ...rows]
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          if (s.includes(",") || s.includes('"') || s.includes("\n")) {
            return `"${s.replace(/"/g, '""')}"`;
          }
          return s;
        })
        .join(","),
    )
    .join("\n");

  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bronlar-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function useIsMobile(): boolean {
  return useSyncExternalStore(
    (callback) => {
      if (typeof window === "undefined") return () => {};
      const mq = window.matchMedia("(max-width: 768px)");
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    () => (typeof window !== "undefined" ? window.matchMedia("(max-width: 768px)").matches : false),
    () => false,
  );
}

export function ReservationsView() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  const { data, isLoading, isError, refetch } = useReservations();
  const confirmReservation = useConfirmReservation();
  const rejectReservation = useRejectReservation();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const { data: beds = [] } = useBeds();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);

  const isMobile = useIsMobile();
  const [userViewMode, setUserViewMode] = useState<"table" | "card" | null>(null);
  const viewMode = userViewMode ?? (isMobile ? "card" : "table");

  const urlStatus = parseStatusParam(searchParams.get("status") || searchParams.get("tab"));
  const [prevUrlStatus, setPrevUrlStatus] = useState(urlStatus);
  const [filter, setFilter] = useState<FilterKey>(urlStatus);

  if (urlStatus !== prevUrlStatus) {
    setPrevUrlStatus(urlStatus);
    setFilter(urlStatus);
  }

  const urlQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQ);
  const lastPushedQRef = useRef(urlQ);
  const isInputFocusedRef = useRef(false);

  // Sync external URL changes (e.g. back/forward) to search input without stomping active typing
  useEffect(() => {
    if (!isInputFocusedRef.current && urlQ !== lastPushedQRef.current) {
      setQuery(urlQ);
      lastPushedQRef.current = urlQ;
    }
  }, [urlQ]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  const handleFilterChange = useCallback(
    (newFilter: FilterKey) => {
      setFilter(newFilter);
      const params = new URLSearchParams(searchParams.toString());
      if (newFilter === "all") {
        params.delete("status");
        params.delete("tab");
      } else {
        params.set("status", newFilter.toLowerCase());
        params.delete("tab");
      }
      const qs = params.toString();
      const nextUrl = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    },
    [pathname, router, searchParams, setFilter],
  );

  // Debounce search query sync to URL params
  useEffect(() => {
    const timer = setTimeout(() => {
      const currentQ = searchParams.get("q") ?? "";
      const trimmed = query.trim();
      if (trimmed === currentQ) return;

      lastPushedQRef.current = trimmed;
      const params = new URLSearchParams(searchParams.toString());
      if (trimmed) {
        params.set("q", trimmed);
      } else {
        params.delete("q");
      }
      const qs = params.toString();
      const nextUrl = qs ? `${pathname}?${qs}` : pathname;
      startTransition(() => {
        router.replace(nextUrl, { scroll: false });
      });
    }, 300);

    return () => clearTimeout(timer);
  }, [query, pathname, router, searchParams]);

  const [walkInOpen, setWalkInOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ReservationView | null>(null);
  const [assignTarget, setAssignTarget] = useState<ReservationView | null>(null);
  const [checkOutTarget, setCheckOutTarget] = useState<ReservationView | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const selectedReservation = useMemo(() => {
    if (!selectedReservationId) return null;
    return data.find((r) => r.id === selectedReservationId) ?? null;
  }, [data, selectedReservationId]);

  const counts = useMemo(() => {
    const c: Record<FilterKey, number> = {
      all: data.length,
      [BookingStatus.PENDING]: 0,
      [BookingStatus.AWAITING_PAYMENT]: 0,
      [BookingStatus.AWAITING_PARTNER_CONFIRMATION]: 0,
      [BookingStatus.CONFIRMED]: 0,
      IN_HOUSE: 0,
      [BookingStatus.COMPLETED]: 0,
      [BookingStatus.CANCELLED]: 0,
      [BookingStatus.EXPIRED]: 0,
    };
    for (const r of data) {
      if (r.status in c) {
        c[r.status as FilterKey]++;
      }
    }
    // "Yangi" tabida PENDING va AWAITING_PARTNER_CONFIRMATION ikkisi ham hisoblanadi
    c[BookingStatus.PENDING] =
      c[BookingStatus.PENDING] + c[BookingStatus.AWAITING_PARTNER_CONFIRMATION];
    return c;
  }, [data]);

  const stats = useMemo(() => {
    const active = data.filter(
      (r) =>
        r.status !== BookingStatus.CANCELLED &&
        r.status !== BookingStatus.EXPIRED &&
        r.status !== BookingStatus.COMPLETED,
    );
    const arrivalsToday = data.filter(
      (r) =>
        r.checkIn.slice(0, 10) === today &&
        (r.status === BookingStatus.CONFIRMED ||
          r.status === BookingStatus.PENDING ||
          r.status === BookingStatus.AWAITING_PARTNER_CONFIRMATION),
    );
    const unpaid = active.reduce(
      (sum, r) => sum + Math.max(0, r.totalPrice - r.paidAmount),
      0,
    );
    return {
      active: active.length,
      arrivalsToday: arrivalsToday.length,
      pending: counts[BookingStatus.PENDING],
      unpaid,
    };
  }, [counts, data, today]);

  const filtered = useMemo(() => {
    let list = data;
    if (filter !== "all") {
      if (filter === BookingStatus.PENDING) {
        list = list.filter(
          (r) =>
            r.status === BookingStatus.PENDING ||
            r.status === BookingStatus.AWAITING_PARTNER_CONFIRMATION,
        );
      } else {
        list = list.filter((r) => r.status === filter);
      }
    }
    if (startDate) list = list.filter((r) => r.checkIn.slice(0, 10) >= startDate);
    if (endDate) list = list.filter((r) => r.checkIn.slice(0, 10) <= endDate);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        [r.id, r.guest.fullName, r.guest.phone, r.roomTypeName, r.roomNumber]
          .filter(Boolean)
          .join(" ")
          .toLowerCase()
          .includes(q),
      );
    }
    return [...list].sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  }, [data, endDate, filter, query, startDate]);

  const focusItems = useMemo(() => {
    return data
      .filter(
        (r) =>
          r.status === BookingStatus.PENDING ||
          r.status === BookingStatus.AWAITING_PARTNER_CONFIRMATION ||
          r.status === BookingStatus.AWAITING_PAYMENT ||
          (r.checkIn.slice(0, 10) === today && r.status === BookingStatus.CONFIRMED),
      )
      .sort((a, b) => {
        const priority = (r: ReservationView) =>
          r.status === BookingStatus.PENDING ||
          r.status === BookingStatus.AWAITING_PARTNER_CONFIRMATION
            ? 0
            : r.checkIn.slice(0, 10) === today
              ? 1
              : 2;
        return priority(a) - priority(b) || a.checkIn.localeCompare(b.checkIn);
      })
      .slice(0, 5);
  }, [data, today]);

  const handleConfirm = (reservation: ReservationView) => {
    confirmReservation.mutate(reservation.id, {
      onSuccess: () => toast.success(`Bron tasdiqlandi: ${reservation.id}`),
    });
  };

  const handleCheckIn = (reservation: ReservationView) => {
    setAssignTarget(reservation);
  };

  const handleCheckOut = (reservation: ReservationView) => {
    setCheckOutTarget(reservation);
  };

  const hasDateFilter = Boolean(startDate || endDate);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        eyebrow="Bron boshqaruvi"
        title={labels.reservationsTitle}
        description={`Web-userdan kelgan buyurtmalar, walk-in bronlar, to'lov va ${labels.checkInLabel.toLowerCase()} jarayonlari.`}
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              disabled={filtered.length === 0}
              onClick={() => {
                exportToCsv(filtered, labels.unitSingular, beds, restaurant);
                toast.success(`${filtered.length} ta bron eksport qilindi`);
              }}
            >
              <Download className="h-4 w-4" aria-hidden />
              CSV
            </Button>
            <Button size="sm" onClick={() => setWalkInOpen(true)}>
              <CalendarPlus className="h-4 w-4" aria-hidden />
              {labels.walkInTitle}
            </Button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          icon={<CalendarRange />}
          label="Faol bronlar"
          value={stats.active.toString()}
          hint="Bekor va yakunlanganlardan tashqari"
        />
        <MetricCard
          icon={<Clock3 />}
          label="Javob kutilmoqda"
          value={stats.pending.toString()}
          hint="Tez tasdiqlash kerak"
          tone={stats.pending > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          icon={<CalendarCheck />}
          label="Bugungi kelishlar"
          value={stats.arrivalsToday.toString()}
          hint={`${labels.checkInLabel} uchun tayyor`}
          tone="brand"
        />
        <MetricCard
          icon={<Wallet />}
          label="Qoldiq to'lov"
          value={formatMoney(stats.unpaid)}
          hint="Faol bronlar bo'yicha"
          tone={stats.unpaid > 0 ? "danger" : "accent"}
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
          <Card>
            <CardBody className="flex flex-col gap-3">
              <div>
                <h2 className="text-sm font-semibold">Diqqat kerak</h2>
                <p className="mt-1 text-xs leading-5 text-[var(--muted-foreground)]">
                  Yangi bronlar, bugungi kelishlar va to'lov kutilayotganlar.
                </p>
              </div>

              {focusItems.length === 0 ? (
                <div className="rounded-md bg-[var(--surface-muted)] p-3 text-sm text-[var(--muted-foreground)]">
                  Hozircha shoshilinch ish yo'q.
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {focusItems.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setSelectedReservationId(r.id)}
                      className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-3 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-sm font-semibold">
                          {r.guest.fullName}
                        </span>
                        <ChevronRight className="h-4 w-4 shrink-0 text-[var(--muted-foreground)]" />
                      </div>
                      <p className="mt-1 text-xs text-[var(--muted-foreground)]">
                        {formatDate(r.checkIn)}
                        {r.slotTime ? ` ${r.slotTime}` : ""} · {r.roomTypeName}
                      </p>
                      <div className="mt-2">
                        <ReservationStatusBadge status={r.status} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="flex flex-col gap-2">
              <h2 className="text-sm font-semibold">Status filteri</h2>
              <Tabs
                value={filter}
                onValueChange={(val) => handleFilterChange(val as FilterKey)}
                orientation="vertical"
                variant="pills"
                className="w-full"
              >
                <TabsList aria-label="Status bo'yicha filter" className="w-full gap-1 p-0 bg-transparent flex flex-col">
                  {FILTERS.map((f) => {
                    const active = filter === f.key;
                    return (
                      <TabsTrigger
                        key={f.key}
                        value={f.key}
                        className={cn(
                          "w-full flex items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[40px]",
                          active
                            ? "!bg-brand-700 !text-white shadow-sm"
                            : "text-zinc-600 hover:bg-[var(--surface-muted)] dark:text-zinc-300",
                        )}
                      >
                        <span>{f.label}</span>
                        <span
                          className={cn(
                            "rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                            active
                              ? "bg-white/20 text-white"
                              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
                          )}
                        >
                          {counts[f.key]}
                        </span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
              </Tabs>
            </CardBody>
          </Card>
        </aside>

        <section className="flex min-w-0 flex-col gap-3">
          {/* Search, Date Range Filter & View Toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-1 flex-wrap items-center gap-2 min-w-[280px]">
              <div className="relative min-w-[200px] flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
                  aria-hidden
                />
                <Input
                  type="search"
                  placeholder={`ID, ism, telefon, ${labels.unitSingular} bo'yicha qidirish...`}
                  className="pl-9 h-10"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onFocus={() => {
                    isInputFocusedRef.current = true;
                  }}
                  onBlur={() => {
                    isInputFocusedRef.current = false;
                  }}
                  aria-label="Bronlar ichidan qidirish"
                />
              </div>

              {/* Date range filters */}
              <div className="flex items-center gap-1.5 bg-[var(--surface-muted)] p-1 rounded-lg border border-[var(--border)] w-full sm:w-auto">
                <Input
                  type="date"
                  value={startDate}
                  max={endDate || undefined}
                  onChange={(e) => {
                    const val = e.target.value;
                    setStartDate(val);
                    if (endDate && val > endDate) {
                      setEndDate("");
                    }
                  }}
                  className="h-8 text-xs flex-1 sm:w-[130px] border-0 bg-transparent px-2 shadow-none focus-visible:ring-1"
                  title="Boshlanish sanasi"
                  aria-label="Boshlanish sanasi"
                />
                <span className="text-xs text-[var(--muted-foreground)]">→</span>
                <Input
                  type="date"
                  value={endDate}
                  min={startDate || undefined}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEndDate(val);
                    if (startDate && val < startDate) {
                      setStartDate("");
                    }
                  }}
                  className="h-8 text-xs flex-1 sm:w-[130px] border-0 bg-transparent px-2 shadow-none focus-visible:ring-1"
                  title="Tugash sanasi"
                  aria-label="Tugash sanasi"
                />
                {hasDateFilter && (
                  <button
                    type="button"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                    className="p-1 rounded text-[var(--muted-foreground)] hover:text-red-600 transition-colors"
                    title="Sanani tozalash"
                    aria-label="Sanani tozalash"
                  >
                    <FilterX className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div
                role="group"
                aria-label="Ko'rinish rejimi"
                className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-1"
              >
                <button
                  type="button"
                  onClick={() => setUserViewMode("table")}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                    viewMode === "table"
                      ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                  title="Jadval ko'rinishi"
                  aria-pressed={viewMode === "table"}
                >
                  <List className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Jadval</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUserViewMode("card")}
                  className={cn(
                    "flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                    viewMode === "card"
                      ? "bg-[var(--surface)] text-[var(--foreground)] shadow-xs"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
                  )}
                  title="Kartochka ko'rinishi"
                  aria-pressed={viewMode === "card"}
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  <span className="hidden sm:inline">Kartochka</span>
                </button>
              </div>

              <span className="rounded-full bg-[var(--surface-muted)] px-3 py-1 text-xs font-medium text-[var(--muted-foreground)] whitespace-nowrap">
                {filtered.length} ta natija
              </span>
            </div>
          </div>

          {isLoading ? (
            <LoadingState title="Bronlar yuklanmoqda..." />
          ) : isError ? (
            <ErrorState 
              title="Bronlarni yuklashda xatolik yuz berdi" 
              action={<Button onClick={() => refetch()} variant="outline" size="sm">Qayta urinish</Button>} 
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={<CalendarRange className="h-10 w-10" aria-hidden />}
              title="Bron topilmadi"
              description="Filter, sana yoki qidiruvni o'zgartirib ko'ring."
              action={
                hasDateFilter ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setStartDate("");
                      setEndDate("");
                    }}
                  >
                    Sana filtrini tozalash
                  </Button>
                ) : (query || filter !== "all") ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setQuery("");
                      lastPushedQRef.current = "";
                      setFilter("all");
                      const params = new URLSearchParams(searchParams.toString());
                      params.delete("status");
                      params.delete("tab");
                      params.delete("q");
                      const qs = params.toString();
                      const nextUrl = qs ? `${pathname}?${qs}` : pathname;
                      startTransition(() => {
                        router.replace(nextUrl, { scroll: false });
                      });
                    }}
                  >
                    Filtrlarni tozalash
                  </Button>
                ) : undefined
              }
            />
          ) : viewMode === "table" ? (
            <ReservationsTable
              data={filtered}
              beds={beds}
              unitLabel={labels.unitSingular}
              isRestaurant={restaurant}
              isBus={isBus}
              checkInLabel={labels.checkInLabel}
              checkOutLabel={labels.checkOutLabel}
              onSelect={(r) => setSelectedReservationId(r.id)}
              onConfirm={handleConfirm}
              onReject={(r) => setRejectTarget(r)}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
            />
          ) : (
            <div className="grid gap-3">
              {filtered.map((reservation) => (
                <ReservationCard
                  key={reservation.id}
                  reservation={reservation}
                  onOpen={() => setSelectedReservationId(reservation.id)}
                  onConfirm={() => handleConfirm(reservation)}
                  onReject={() => setRejectTarget(reservation)}
                  onCheckIn={() => handleCheckIn(reservation)}
                  onCheckOut={() => handleCheckOut(reservation)}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Quick Drawer */}
      <ReservationQuickDrawer
        reservation={selectedReservation}
        open={Boolean(selectedReservation)}
        onClose={() => setSelectedReservationId(null)}
        onConfirm={(r) => handleConfirm(r)}
        onReject={(r) => {
          setSelectedReservationId(null);
          setRejectTarget(r);
        }}
        onCheckIn={(r) => {
          setSelectedReservationId(null);
          handleCheckIn(r);
        }}
        onCheckOut={(r) => {
          setSelectedReservationId(null);
          handleCheckOut(r);
        }}
      />

      <WalkInDialog open={walkInOpen} onClose={() => setWalkInOpen(false)} />
      <CheckInDialog
        open={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        reservation={assignTarget}
        onAssigned={() => {
          if (assignTarget) {
            checkIn.mutate(assignTarget.id, {
              onSuccess: () => {
                toast.success(`Check-in qilindi: ${assignTarget.guest.fullName}`);
              },
            });
          }
        }}
      />
      <ConfirmDialog
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onConfirm={() => {
          if (rejectTarget) {
            rejectReservation.mutate(
              { id: rejectTarget.id, reason: "Hamkor tomonidan rad etildi" },
              {
                onSuccess: () => {
                  toast.success(`Bron rad etildi: ${rejectTarget.id}`);
                  setRejectTarget(null);
                },
              },
            );
          }
        }}
        title="Bron rad etilsinmi?"
        description={
          rejectTarget
            ? `${rejectTarget.guest.fullName} ning bronini rad etmoqchimisiz?`
            : undefined
        }
        confirmLabel="Ha, rad etish"
        tone="danger"
      />
      <ConfirmDialog
        open={Boolean(checkOutTarget)}
        onClose={() => setCheckOutTarget(null)}
        onConfirm={() => {
          if (checkOutTarget) {
            checkOut.mutate(checkOutTarget.id, {
              onSuccess: () => {
                toast.success(`${labels.checkOutLabel} qilindi: ${checkOutTarget.guest.fullName}`);
                setCheckOutTarget(null);
              },
            });
          }
        }}
        title={`${labels.checkOutLabel} qilinsinmi?`}
        description={
          checkOutTarget
            ? `${checkOutTarget.guest.fullName} ning chiqishini tasdiqlaysizmi?`
            : undefined
        }
        confirmLabel="Ha, chiqish qilish"
        tone="primary"
      />
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
  hint,
  tone = "neutral",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  tone?: "neutral" | "brand" | "accent" | "warning" | "danger";
}) {
  const toneClass = {
    neutral: "bg-[var(--surface-muted)] text-[var(--muted-foreground)]",
    brand: "bg-brand-50 text-brand-700 dark:bg-brand-950/35 dark:text-brand-200",
    accent:
      "bg-accent-50 text-accent-700 dark:bg-accent-950/35 dark:text-accent-200",
    warning: "bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-200",
    danger: "bg-red-50 text-red-700 dark:bg-red-950/35 dark:text-red-200",
  }[tone];

  return (
    <Card>
      <CardBody className="flex items-center gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-md [&>svg]:h-5 [&>svg]:w-5", toneClass)}>
          {icon}
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">
            {label}
          </p>
          <p className="mt-0.5 truncate text-lg font-semibold">{value}</p>
          <p className="truncate text-[11px] text-[var(--muted-foreground)]">
            {hint}
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

function ReservationCard({
  reservation,
  onOpen,
  onConfirm,
  onReject,
  onCheckIn,
  onCheckOut,
}: {
  reservation: ReservationView;
  onOpen: () => void;
  onConfirm: () => void;
  onReject: () => void;
  onCheckIn: () => void;
  onCheckOut?: () => void;
}) {
  const balance = Math.max(0, reservation.totalPrice - reservation.paidAmount);
  const today = new Date().toISOString().split("T")[0];
  const isPastCheckIn = today > reservation.checkIn.slice(0, 10);
  const isPastCheckOut = today > reservation.checkOut.slice(0, 10);
  const canConfirm =
    (reservation.status === BookingStatus.PENDING ||
      reservation.status === BookingStatus.AWAITING_PARTNER_CONFIRMATION) &&
    !isPastCheckIn;
  const canCheckIn = reservation.status === BookingStatus.CONFIRMED && !isPastCheckOut;
  const canCheckOut = reservation.status === "IN_HOUSE";
  const { data: beds = [] } = useBeds();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);

  return (
    <Card interactive>
      <CardBody className="p-0">
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
          className="grid w-full cursor-pointer gap-0 text-left lg:grid-cols-[minmax(0,1fr)_220px]"
        >
          <div className="flex min-w-0 flex-col gap-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-brand-700 dark:text-brand-300">
                    {reservation.id}
                  </span>
                  <SourceBadge source={reservation.source} />
                  <ReservationStatusBadge status={reservation.status} />
                  {reservation.paidAmount >= reservation.totalPrice && reservation.totalPrice > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                      To'langan
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                      Qoldiq to'lov bor
                    </span>
                  )}
                </div>
                <h3 className="mt-2 truncate text-lg font-semibold">
                  {reservation.guest.fullName}
                </h3>
                <p className="mt-1 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
                  <UserPlus className="h-4 w-4" aria-hidden />
                  {formatPhone(reservation.guest.phone)}
                </p>
              </div>
              <ChevronRight className="hidden h-5 w-5 text-[var(--muted-foreground)] sm:block" />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <MiniInfo
                icon={<CalendarRange />}
                label={isBus ? "Olib ketish vaqti" : "Kelish"}
                value={
                  restaurant && reservation.slotTime
                    ? `${formatDate(reservation.checkIn)} · ${reservation.slotTime}`
                    : formatDate(reservation.checkIn)
                }
              />
              <MiniInfo
                icon={<CalendarRange />}
                label={isBus ? "Qaytarish vaqti" : "Ketish"}
                value={
                  restaurant
                    ? formatDate(reservation.checkOut)
                    : isBus
                      ? `${formatDate(reservation.checkOut)} · ${reservation.nights} kun`
                      : `${formatDate(reservation.checkOut)} · ${reservation.nights} kech.`
                }
              />
              <MiniInfo
                icon={isBus ? <CarFront /> : restaurant ? <UtensilsCrossed /> : <BedDouble />}
                label={labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)}
                value={`${reservation.roomTypeName}${
                  reservation.roomNumber ? ` · ${reservation.roomNumber}` : ""
                }${
                  reservation.bedId
                    ? ` · ${beds.find((b) => b.id === reservation.bedId)?.label ?? ""}`
                    : ""
                }`}
              />
            </div>

            {reservation.specialRequests && (
              <p className="rounded-md bg-[var(--surface-muted)] px-3 py-2 text-xs leading-5 text-[var(--muted-foreground)]">
                {reservation.specialRequests}
              </p>
            )}
          </div>

          <div className="flex flex-col justify-between gap-3 border-t border-[var(--border)] p-4 lg:border-l lg:border-t-0">
            <div className="grid gap-2 text-sm">
              <MoneyRow label="Jami" value={formatMoney(reservation.totalPrice)} />
              <MoneyRow
                label="To'langan"
                value={formatMoney(reservation.paidAmount)}
                tone={reservation.paidAmount > 0 ? "accent" : "muted"}
              />
              <MoneyRow
                label="Qoldiq"
                value={formatMoney(balance)}
                tone={balance > 0 ? "danger" : "accent"}
                bold
              />
            </div>

            <div
              className="flex flex-wrap gap-2 lg:justify-end"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              {canConfirm && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onReject();
                    }}
                  >
                    <XCircle className="h-4 w-4" aria-hidden />
                    Rad
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onConfirm();
                    }}
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    Tasdiqlash
                  </Button>
                </>
              )}
              {canCheckIn && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => {
                    onCheckIn();
                  }}
                >
                  <CalendarCheck className="h-4 w-4" aria-hidden />
                  {labels.checkInLabel}
                </Button>
              )}
              {canCheckOut && onCheckOut && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    onCheckOut();
                  }}
                >
                  <LogOut className="h-4 w-4" aria-hidden />
                  {labels.checkOutLabel}
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function MiniInfo({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md bg-[var(--surface-muted)] px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)] [&>svg]:h-3.5 [&>svg]:w-3.5">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-medium">{value}</p>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  tone = "muted",
  bold = false,
}: {
  label: string;
  value: string;
  tone?: "muted" | "accent" | "danger";
  bold?: boolean;
}) {
  const toneClass =
    tone === "accent"
      ? "text-accent-600"
      : tone === "danger"
        ? "text-red-600"
        : "text-[var(--muted-foreground)]";
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className={cn("text-right", toneClass, bold && "font-bold")}>
        {value}
      </span>
    </div>
  );
}
