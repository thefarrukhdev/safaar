"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CalendarPlus } from "lucide-react";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import { Button } from "../../_components/ui/button";
import { ConfirmDialog } from "../../_components/ui/dialog";
import { useConfirm } from "../../_components/ui/confirm-dialog";
import { EmptyState, LoadingState, ErrorState } from "../../_components/ui/empty-state";
import { BulkActionBar } from "../../_components/domain/bulk-action-bar";
import { CheckInDialog } from "../../_components/domain/check-in-dialog";
import { AssignRoomDialog } from "../../_components/domain/assign-room-dialog";
import { AssignBedDialog } from "../../_components/domain/assign-bed-dialog";
import { WalkInDialog } from "../../_components/domain/walk-in-dialog";
import {
  useReservations,
  useConfirmReservation,
  useRejectReservation,
  useCheckIn,
  useCheckOut,
} from "../../_hooks/use-reservations";
import { useBeds } from "../../_hooks/use-beds";
import { useSocket } from "../../_hooks/use-socket";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels, hasBeds, hasBuses, isRestaurant } from "../../_lib/utils/partner-labels";
import { todayIso } from "../../_lib/utils/date";
import type { ReservationView } from "../../_lib/domain/types";
import {
  parseStatusParam,
  type FilterKey,
  type ReservationStatsData,
  type ViewMode,
} from "./types";
import { ReservationsHeader } from "./reservations-header";
import { ReservationsStats } from "./reservations-stats";
import { ReservationsFocus } from "./reservations-focus";
import { ReservationsFilters } from "./reservations-filters";
import { ReservationsTable } from "./reservations-table";
import { ReservationsCards } from "./reservations-cards";
import { ReservationQuickDrawer } from "./reservation-quick-drawer";

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

  // Queries and mutations
  const { data = [], isLoading, isError, refetch, isFetching } = useReservations();
  const confirmReservation = useConfirmReservation();
  const rejectReservation = useRejectReservation();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  const { data: beds = [] } = useBeds();
  const { connected: isRealtimeConnected } = useSocket();

  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);

  // Responsive view mode
  const isMobile = useIsMobile();
  const [userViewMode, setUserViewMode] = useState<ViewMode | null>(null);
  const viewMode: ViewMode = userViewMode ?? (isMobile ? "card" : "table");

  // Status Filter synchronized with URL
  const urlStatus = parseStatusParam(searchParams.get("status") || searchParams.get("tab"));
  const [prevUrlStatus, setPrevUrlStatus] = useState(urlStatus);
  const [filter, setFilter] = useState<FilterKey>(urlStatus);

  if (urlStatus !== prevUrlStatus) {
    setPrevUrlStatus(urlStatus);
    setFilter(urlStatus);
  }

  // Search query synchronized with URL (with debounce)
  const urlQ = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(urlQ);
  const lastPushedQRef = useRef(urlQ);

  useEffect(() => {
    if (urlQ !== lastPushedQRef.current) {
      setQuery(urlQ);
      lastPushedQRef.current = urlQ;
    }
  }, [urlQ]);

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedReservationId, setSelectedReservationId] = useState<string | null>(null);

  // Dialog targets
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState<ReservationView | null>(null);
  const [assignTarget, setAssignTarget] = useState<ReservationView | null>(null);
  const [roomAssignTarget, setRoomAssignTarget] = useState<ReservationView | null>(null);
  const [checkOutTarget, setCheckOutTarget] = useState<ReservationView | null>(null);

  // Multi-select & Bulk operations
  const [selectedReservationIds, setSelectedReservationIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const confirm = useConfirm();

  // Handle status filter change
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
    [pathname, router, searchParams],
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

  const selectedReservation = useMemo(() => {
    if (!selectedReservationId) return null;
    return data.find((r) => r.id === selectedReservationId) ?? null;
  }, [data, selectedReservationId]);

  // Status counts
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

  // Overall Statistics (dynamic current date for 24/7 reception displays)
  const stats: ReservationStatsData = useMemo(() => {
    const today = todayIso();
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
    const totalRevenue = data.reduce((sum, r) => sum + r.paidAmount, 0);

    return {
      active: active.length,
      arrivalsToday: arrivalsToday.length,
      pending: counts[BookingStatus.PENDING],
      unpaid,
      totalRevenue,
    };
  }, [counts, data]);

  // Filtered Reservations List
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
    return [...list].sort((a, b) => {
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      if (dateB !== dateA) return dateB - dateA;
      return a.checkIn.localeCompare(b.checkIn);
    });
  }, [data, endDate, filter, query, startDate]);

  // Focus queue (high urgency items)
  const focusItems = useMemo(() => {
    const today = todayIso();
    const isRecent = (r: ReservationView) =>
      r.createdAt ? Date.now() - new Date(r.createdAt).getTime() < 24 * 3600 * 1000 : false;
    return data
      .filter(
        (r) =>
          r.status === BookingStatus.PENDING ||
          r.status === BookingStatus.AWAITING_PARTNER_CONFIRMATION ||
          r.status === BookingStatus.AWAITING_PAYMENT ||
          ((r.checkIn.slice(0, 10) === today || isRecent(r)) && r.status === BookingStatus.CONFIRMED),
      )
      .sort((a, b) => {
        const priority = (r: ReservationView) =>
          r.status === BookingStatus.PENDING ||
          r.status === BookingStatus.AWAITING_PARTNER_CONFIRMATION
            ? 0
            : r.checkIn.slice(0, 10) === today
              ? 1
              : 2;
        return (
          priority(a) - priority(b) ||
          (b.createdAt || "").localeCompare(a.createdAt || "") ||
          a.checkIn.localeCompare(b.checkIn)
        );
      })
      .slice(0, 5);
  }, [data]);

  // Action handlers
  const handleConfirm = useCallback(
    (reservation: ReservationView) => {
      confirmReservation.mutate(reservation.id, {
        onSuccess: () => toast.success(`Bron tasdiqlandi: #${reservation.id}`),
      });
    },
    [confirmReservation],
  );

  const handleCheckIn = useCallback((reservation: ReservationView) => {
    setAssignTarget(reservation);
  }, []);

  const handleAssignRoom = useCallback((reservation: ReservationView) => {
    setRoomAssignTarget(reservation);
  }, []);

  const handleCheckOut = useCallback((reservation: ReservationView) => {
    setCheckOutTarget(reservation);
  }, []);

  // Multi-select handlers
  const handleToggleSelectReservation = useCallback((id: string) => {
    setSelectedReservationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const handleToggleSelectAllReservations = useCallback(() => {
    setSelectedReservationIds((prev) => {
      const isAllSelected = filtered.length > 0 && filtered.every((r) => prev.has(r.id));
      if (isAllSelected) {
        const next = new Set(prev);
        for (const r of filtered) {
          next.delete(r.id);
        }
        return next;
      }
      const next = new Set(prev);
      for (const r of filtered) {
        next.add(r.id);
      }
      return next;
    });
  }, [filtered]);

  // Bulk actions
  const handleBulkConfirmReservations = async () => {
    const ids = Array.from(selectedReservationIds);
    const pendings = data.filter(
      (r) =>
        ids.includes(r.id) &&
        (r.status === BookingStatus.PENDING ||
          r.status === BookingStatus.AWAITING_PARTNER_CONFIRMATION),
    );

    if (pendings.length === 0) {
      toast.info("Tanlanganlar ichida tasdiqlash kutilayotgan yangi bronlar yo'q");
      return;
    }

    setIsBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        pendings.map((r) => confirmReservation.mutateAsync(r.id)),
      );
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected").length;

      if (rejected === 0) {
        toast.success(`${fulfilled} ta bron muvaffaqiyatli tasdiqlandi`);
        setSelectedReservationIds(new Set());
      } else {
        toast.warning(`${fulfilled} ta tasdiqlandi, ${rejected} tasida xatolik yuz berdi`);
        const failedIds = new Set(
          pendings
            .filter((_, idx) => results[idx].status === "rejected")
            .map((r) => r.id),
        );
        setSelectedReservationIds(failedIds);
      }
    } catch {
      toast.error("Ommaviy tasdiqlashda xatolik yuz berdi");
    } finally {
      setIsBulkProcessing(false);
      void refetch();
    }
  };

  const handleBulkCancelReservations = async () => {
    const ids = Array.from(selectedReservationIds);
    const cancellables = data.filter(
      (r) =>
        ids.includes(r.id) &&
        r.status !== BookingStatus.CANCELLED &&
        r.status !== BookingStatus.COMPLETED,
    );

    if (cancellables.length === 0) {
      toast.info("Tanlanganlar ichida bekor qilinadigan faol bronlar yo'q");
      return;
    }

    const ok = await confirm({
      title: "Bronlarni bekor qilish",
      description: `Tanlangan ${cancellables.length} ta faol bronni bekor qilishni tasdiqlaysizmi?`,
      confirmText: "Bekor qilish",
      cancelText: "Orqaga",
      destructive: true,
    });
    if (!ok) return;

    setIsBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        cancellables.map((r) =>
          rejectReservation.mutateAsync({
            id: r.id,
            reason: "Hamkor tomonidan guruhli bekor qilindi",
          }),
        ),
      );
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected").length;

      if (rejected === 0) {
        toast.success(`${fulfilled} ta bron bekor qilindi`);
        setSelectedReservationIds(new Set());
      } else {
        toast.warning(`${fulfilled} ta bekor qilindi, ${rejected} tasida xatolik yuz berdi`);
        const failedIds = new Set(
          cancellables
            .filter((_, idx) => results[idx].status === "rejected")
            .map((r) => r.id),
        );
        setSelectedReservationIds(failedIds);
      }
    } catch {
      toast.error("Guruhli bekor qilishda xatolik yuz berdi");
    } finally {
      setIsBulkProcessing(false);
      void refetch();
    }
  };

  const handleResetFilters = useCallback(() => {
    setQuery("");
    lastPushedQRef.current = "";
    setStartDate("");
    setEndDate("");
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
  }, [pathname, router, searchParams]);

  const hasActiveFilters = Boolean(startDate || endDate || query || filter !== "all");

  return (
    <div className="flex flex-col gap-5">
      {/* 1. Header with live status, CSV export, Walk-in dialog trigger */}
      <ReservationsHeader
        labels={labels}
        filteredCount={filtered.length}
        filteredReservations={filtered}
        beds={beds}
        isRestaurant={restaurant}
        isFetching={isFetching}
        isRealtimeConnected={isRealtimeConnected}
        onRefresh={() => {
          void refetch();
          toast.success("Bronlar ma'lumoti yangilandi");
        }}
        onOpenWalkIn={() => setWalkInOpen(true)}
      />

      {/* 2. Top KPI Statistics Cards */}
      <ReservationsStats
        stats={stats}
        labels={labels}
        activeFilter={filter}
        isLoading={isLoading}
        onSelectFilter={handleFilterChange}
        onSelectToday={() => {
          setStartDate(todayIso());
          setEndDate(todayIso());
        }}
      />

      {/* 3. Main Split View: Sidebar + List Area */}
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)]">
        {/* Sidebar: Urgent Priority Items + Status Navigation Tabs */}
        <ReservationsFocus
          focusItems={focusItems}
          counts={counts}
          activeFilter={filter}
          partnerType={partnerType}
          onFilterChange={handleFilterChange}
          onSelectReservation={(id) => setSelectedReservationId(id)}
        />

        {/* Content Area: Filter Toolbar + Data Table / Cards */}
        <section className="flex min-w-0 flex-col gap-3.5">
          {/* Filter Toolbar */}
          <ReservationsFilters
            query={query}
            onQueryChange={setQuery}
            startDate={startDate}
            endDate={endDate}
            onDateChange={({ startDate: s, endDate: e }) => {
              setStartDate(s);
              setEndDate(e);
            }}
            viewMode={viewMode}
            onViewModeChange={(m) => setUserViewMode(m)}
            filteredCount={filtered.length}
            totalCount={data.length}
            unitSingular={labels.unitSingular}
            guestLabel={labels.guestLabel}
            partnerType={partnerType}
            hasActiveFilters={hasActiveFilters}
            onResetFilters={handleResetFilters}
            statusFilter={filter}
            onStatusFilterChange={handleFilterChange}
            counts={counts}
          />

          {/* Data Presentation */}
          {isLoading ? (
            <LoadingState title="Bronlar yuklanmoqda..." />
          ) : isError ? (
            <ErrorState
              title="Bronlarni yuklashda xatolik yuz berdi"
              description="Server bilan ulanishda muammo yuz berdi yoki seans eskirgan."
              action={
                <Button onClick={() => refetch()} variant="outline" size="sm">
                  Qayta urinish
                </Button>
              }
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              title={
                hasActiveFilters
                  ? "Filtr bo'yicha bron topilmadi"
                  : "Hozircha hech qanday bron mavjud emas"
              }
              description={
                hasActiveFilters
                  ? "Qidiruv, sana oralig'i yoki status filtrini tozalab ko'ring."
                  : "Yangi bronlarni qabul qiling yoki mehmon uchun to'g'ridan-to'g'ri yangi bron yarating."
              }
              action={
                hasActiveFilters ? (
                  <Button variant="outline" size="sm" onClick={handleResetFilters}>
                    Filtrlarni tozalash
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => setWalkInOpen(true)}>
                    <CalendarPlus className="h-4 w-4 mr-1.5" />
                    <span>{labels.walkInTitle}</span>
                  </Button>
                )
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
              checkInActionLabel={labels.checkInActionLabel}
              checkOutActionLabel={labels.checkOutActionLabel}
              onSelect={(r) => setSelectedReservationId(r.id)}
              onConfirm={handleConfirm}
              onReject={(r) => setRejectTarget(r)}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
              onAssignRoom={handleAssignRoom}
              selectedIds={selectedReservationIds}
              onToggleSelect={handleToggleSelectReservation}
              onToggleSelectAll={handleToggleSelectAllReservations}
            />
          ) : (
            <ReservationsCards
              data={filtered}
              beds={beds}
              onSelect={(r) => setSelectedReservationId(r.id)}
              onConfirm={handleConfirm}
              onReject={(r) => setRejectTarget(r)}
              onCheckIn={handleCheckIn}
              onCheckOut={handleCheckOut}
              onAssignRoom={handleAssignRoom}
              selectedIds={selectedReservationIds}
              onToggleSelect={handleToggleSelectReservation}
              onToggleSelectAll={handleToggleSelectAllReservations}
            />
          )}
        </section>
      </div>

      {/* 4. Slide-over Quick Drawer */}
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
        onAssignRoom={(r) => {
          setSelectedReservationId(null);
          handleAssignRoom(r);
        }}
      />

      {/* 5. Dialogs */}
      <WalkInDialog open={walkInOpen} onClose={() => setWalkInOpen(false)} />

      <CheckInDialog
        open={Boolean(assignTarget)}
        onClose={() => setAssignTarget(null)}
        reservation={assignTarget}
        onAssigned={() => {
          if (assignTarget) {
            checkIn.mutate(assignTarget.id, {
              onSuccess: () => {
                toast.success(`Check-in muvaffaqiyatli qilindi: ${assignTarget.guest.fullName}`);
              },
            });
          }
        }}
      />

      {hasBeds(partnerType) ? (
        <AssignBedDialog
          open={Boolean(roomAssignTarget)}
          onClose={() => setRoomAssignTarget(null)}
          reservation={roomAssignTarget}
          onAssigned={() => {
            void refetch();
            setRoomAssignTarget(null);
          }}
        />
      ) : (
        <AssignRoomDialog
          open={Boolean(roomAssignTarget)}
          onClose={() => setRoomAssignTarget(null)}
          reservation={roomAssignTarget}
          onAssigned={() => {
            void refetch();
            setRoomAssignTarget(null);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        onClose={() => setRejectTarget(null)}
        onConfirm={() => {
          if (rejectTarget) {
            rejectReservation.mutate(
              { id: rejectTarget.id, reason: "Hamkor tomonidan rad etildi" },
              {
                onSuccess: () => {
                  toast.success(`Bron rad etildi: #${rejectTarget.id}`);
                  setRejectTarget(null);
                },
              },
            );
          }
        }}
        title="Bron rad etilsinmi?"
        description={
          rejectTarget
            ? `${rejectTarget.guest.fullName} (#${rejectTarget.id}) ning bronini rad etmoqchimisiz?`
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

      {/* 6. Floating Bulk Action Bar */}
      <BulkActionBar
        selectedCount={selectedReservationIds.size}
        onClear={() => setSelectedReservationIds(new Set())}
        entityName="ta bron tanlandi"
        onConfirmAll={handleBulkConfirmReservations}
        onCancelAll={handleBulkCancelReservations}
        isProcessing={isBulkProcessing}
      />
    </div>
  );
}
