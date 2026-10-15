"use client";

import { Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BookingStatus } from "@safaar/types";
import { Button } from "../../_components/ui/button";
import { EmptyState } from "../../_components/ui/empty-state";
import { WalkInDialog, type WalkInInitial } from "../../_components/domain/walk-in-dialog";
import { useGuests } from "../../_hooks/use-guests";
import { useReservations } from "../../_hooks/use-reservations";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels, hasBuses } from "../../_lib/utils/partner-labels";
import type { GuestProfile } from "../../_lib/domain/types";
import { exportGuestsToCsv } from "./export-csv";
import { GuestsHeader } from "./guests-header";
import { GuestsStats } from "./guests-stats";
import { GuestsFilters } from "./guests-filters";
import { GuestsTable } from "./guests-table";
import type { GuestCalculatedStats, GuestStatsData, SortOption } from "./types";

export function GuestsView() {
  const { data = [], isLoading: isGuestsLoading } = useGuests();
  const { data: reservations = [], isLoading: isReservationsLoading } = useReservations();
  const router = useRouter();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const isBus = hasBuses(partnerType);
  const guestPlural = isBus ? "Ijarachilar" : "Mijozlar";

  const [query, setQuery] = useState("");
  const [vipOnly, setVipOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("stays-desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Walk-in modal holati va prefill ma'lumotlari
  const [walkInOpen, setWalkInOpen] = useState(false);
  const [walkInInitial, setWalkInInitial] = useState<WalkInInitial | undefined>(undefined);

  /**
   * Jonli hisoblangan har bir mijoz statistikasi
   */
  const guestStats = useMemo(() => {
    const map = new Map<string, GuestCalculatedStats>();
    for (const g of data) {
      const bookings = reservations.filter(
        (r) => r.guest.id === g.id || r.guest.phone === g.phone,
      );
      const active = bookings.filter(
        (b) => b.status !== BookingStatus.CANCELLED && b.status !== BookingStatus.EXPIRED,
      );
      const rejected = bookings.filter(
        (b) => b.status === BookingStatus.CANCELLED || b.status === BookingStatus.EXPIRED,
      );
      const completed = [...bookings]
        .filter((b) => b.status === BookingStatus.COMPLETED)
        .sort((a, b) => (b.checkIn > a.checkIn ? 1 : -1));

      map.set(g.id, {
        totalStays: active.length,
        totalSpent: active.reduce((sum, b) => sum + b.paidAmount, 0),
        lastStay: completed[0]?.checkIn,
        rejectedStays: rejected.length,
      });
    }
    return map;
  }, [data, reservations]);

  /**
   * Umumiy CRM agregatlari (StatCard'lar uchun)
   */
  const overallStats = useMemo<GuestStatsData>(() => {
    const totalGuests = data.length;
    const vipGuests = data.filter((g) => g.isVip).length;

    let totalStaysSum = 0;
    let totalRevenue = 0;

    for (const stats of guestStats.values()) {
      totalStaysSum += stats.totalStays;
      totalRevenue += stats.totalSpent;
    }

    const avgStays = totalGuests > 0 ? totalStaysSum / totalGuests : 0;

    return {
      totalGuests,
      vipGuests,
      avgStays,
      totalRevenue,
    };
  }, [data, guestStats]);

  /**
   * Filtrlash
   */
  const filtered = useMemo(() => {
    let list = data;
    if (vipOnly) list = list.filter((g) => g.isVip);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((g) =>
        [g.fullName, g.phone, g.email ?? ""].join(" ").toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, query, vipOnly]);

  /**
   * Saralash
   */
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const statsA = guestStats.get(a.id) ?? { totalStays: 0, totalSpent: 0, lastStay: undefined, rejectedStays: 0 };
      const statsB = guestStats.get(b.id) ?? { totalStays: 0, totalSpent: 0, lastStay: undefined, rejectedStays: 0 };

      switch (sortBy) {
        case "name-asc":
          return a.fullName.localeCompare(b.fullName, "uz");
        case "name-desc":
          return b.fullName.localeCompare(a.fullName, "uz");
        case "stays-desc":
          return statsB.totalStays - statsA.totalStays;
        case "spent-desc":
          return statsB.totalSpent - statsA.totalSpent;
        case "last-stay-desc":
          if (!statsA.lastStay && !statsB.lastStay) return 0;
          if (!statsA.lastStay) return 1;
          if (!statsB.lastStay) return -1;
          return statsB.lastStay.localeCompare(statsA.lastStay);
        default:
          return 0;
      }
    });
  }, [filtered, sortBy, guestStats]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sorted.slice(start, start + pageSize);
  }, [sorted, currentPage, pageSize]);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    setPage(1);
  };

  const handleVipToggle = (val: boolean) => {
    setVipOnly(val);
    setPage(1);
  };

  const handleSortChange = (val: SortOption) => {
    setSortBy(val);
    setPage(1);
  };

  const handlePageSizeChange = (val: number) => {
    setPageSize(val);
    setPage(1);
  };

  const handleResetFilters = () => {
    setQuery("");
    setVipOnly(false);
    setPage(1);
  };

  const handleExportCsv = () => {
    exportGuestsToCsv(sorted, guestStats, isBus);
  };

  const handleOpenNewBooking = () => {
    setWalkInInitial(undefined);
    setWalkInOpen(true);
  };

  const handleNewBookingForGuest = (guest: GuestProfile) => {
    setWalkInInitial({
      fullName: guest.fullName,
      phone: guest.phone,
    });
    setWalkInOpen(true);
  };

  const handleRowClick = (guest: GuestProfile) => {
    router.push(`/guests/${guest.id}`);
  };

  const isInitialLoading = isGuestsLoading || isReservationsLoading;

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Header & Actions */}
      <GuestsHeader
        labels={labels}
        guestPlural={guestPlural}
        totalGuests={data.length}
        onExportCsv={handleExportCsv}
        onNewBooking={handleOpenNewBooking}
      />

      {/* 2. CRM KPI Stats */}
      <GuestsStats
        stats={overallStats}
        vipOnly={vipOnly}
        onToggleVip={handleVipToggle}
        isLoading={isInitialLoading}
      />

      {/* 3. Filtrlash va saralash */}
      <GuestsFilters
        query={query}
        onQueryChange={handleQueryChange}
        vipOnly={vipOnly}
        onVipToggle={handleVipToggle}
        sortBy={sortBy}
        onSortChange={handleSortChange}
        vipCount={overallStats.vipGuests}
        guestPlural={guestPlural}
        onReset={handleResetFilters}
      />

      {/* 4. Jadval yoki bo'sh holat */}
      {sorted.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" aria-hidden />}
          title={`${labels.guestLabel} topilmadi`}
          description={
            vipOnly || query
              ? "Filterni o'zgartirib ko'ring yoki boshqa kalit so'z yozing."
              : `${labels.guestLabel}lar bron qilganda shu yerda avtomatik paydo bo'ladi.`
          }
          action={
            vipOnly || query ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
              >
                Filtrlarni tozalash
              </Button>
            ) : undefined
          }
        />
      ) : (
        <GuestsTable
          guests={paginated}
          guestStats={guestStats}
          isBus={isBus}
          guestLabel={labels.guestLabel}
          totalFilteredCount={sorted.length}
          page={currentPage}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={handlePageSizeChange}
          onRowClick={handleRowClick}
          onNewBookingForGuest={handleNewBookingForGuest}
        />
      )}

      {/* 5. Walk-in Dialog (Yangi bron yaratish) */}
      <WalkInDialog
        open={walkInOpen}
        onClose={() => {
          setWalkInOpen(false);
          setWalkInInitial(undefined);
        }}
        initialValues={walkInInitial}
      />
    </div>
  );
}
