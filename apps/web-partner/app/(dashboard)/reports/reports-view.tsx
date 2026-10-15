"use client";

import { useMemo, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../../_components/ui/tabs";
import { PageHeader } from "../../_components/layout/page-header";
import {
  buildDachaAvailabilitySummary,
  buildDailyStats,
  buildSourceDistribution,
  buildUnitTypeDistribution,
} from "../../_lib/domain/reports";
import { useReservations } from "../../_hooks/use-reservations";
import { useRooms } from "../../_hooks/use-rooms";
import { useBeds } from "../../_hooks/use-beds";
import { useRoomTypes } from "../../_hooks/use-room-types";
import { useDataStore } from "../../_stores/data-store";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels, hasBuses, isDacha, isRestaurant } from "../../_lib/utils/partner-labels";
import { TODAY_ISO } from "../../_lib/utils/date";
import { useWithdrawals, useCreateWithdrawal } from "../../_hooks/use-withdrawals";
import type { DateRange } from "../../_components/ui/date-range-picker";
import { ReportsStatsTab } from "./reports-stats-tab";
import { ReportsFinanceTab } from "./reports-finance-tab";
import { ReportsDetailedTab } from "./reports-detailed-tab";
import type { TimeRangePreset, ViewTab } from "./types";

export function ReportsView() {
  const [activeTab, setActiveTab] = useState<ViewTab>("stats");
  const [timeRange, setTimeRange] = useState<TimeRangePreset>("30days");
  const [customRange, setCustomRange] = useState<DateRange>({
    startDate: "",
    endDate: "",
  });

  const { data: reservations = [] } = useReservations();
  const { data: rooms = [] } = useRooms();
  const { data: beds = [] } = useBeds();
  const { data: roomTypes = [] } = useRoomTypes();
  const getStats = useDataStore((s) => s.getStats);
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const dacha = isDacha(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);

  // Moliya bo'limi (Withdrawals)
  const {
    data: withdrawals = [],
    isLoading: financeLoading,
    isError: financeError,
    refetch: refetchWithdrawals,
  } = useWithdrawals(activeTab === "finance");
  const createWithdrawalMutation = useCreateWithdrawal();

  const handleWithdrawalSubmit = async (amount: number, bankAccount: string) => {
    await createWithdrawalMutation.mutateAsync({ amount, bankAccount });
  };

  /**
   * Tanlangan oraliqqa qarab kunlar sonini va asosiy sanani hisoblash
   */
  const { daysForRange, anchorDateIso } = useMemo(() => {
    if (timeRange === "custom" && customRange.startDate && customRange.endDate) {
      const start = new Date(customRange.startDate).getTime();
      const end = new Date(customRange.endDate).getTime();
      const diffDays = Math.max(
        1,
        Math.min(365, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1),
      );
      return { daysForRange: diffDays, anchorDateIso: customRange.endDate };
    }

    const days = timeRange === "7days" ? 7 : timeRange === "year" ? 365 : 30;
    return { daysForRange: days, anchorDateIso: TODAY_ISO };
  }, [timeRange, customRange]);

  const dailyStats = useMemo(
    () => buildDailyStats(reservations, anchorDateIso, daysForRange),
    [reservations, anchorDateIso, daysForRange],
  );

  const stats = getStats({ reservations, rooms, beds });
  const totalUnits = stats.totalRooms;

  const revenueData = useMemo(
    () => dailyStats.map((d) => ({ date: d.date, revenue: d.revenue, bookings: d.bookings })),
    [dailyStats],
  );

  const occupancyData = useMemo(
    () =>
      dailyStats.map((d) => ({
        date: d.date,
        occupancy:
          totalUnits > 0
            ? Math.min(100, Math.round((d.occupiedUnits / totalUnits) * 100))
            : 0,
      })),
    [dailyStats, totalUnits],
  );

  const unitTypeDistribution = useMemo(
    () => buildUnitTypeDistribution(reservations, roomTypes),
    [reservations, roomTypes],
  );

  const sourceDistribution = useMemo(
    () => buildSourceDistribution(reservations),
    [reservations],
  );

  const dachaSummary = useMemo(
    () => buildDachaAvailabilitySummary(dailyStats),
    [dailyStats],
  );

  const totalRevenue = revenueData.reduce((s, d) => s + d.revenue, 0);
  const totalBookings = revenueData.reduce((s, d) => s + d.bookings, 0);
  const avgOccupancy = occupancyData.length
    ? Math.round(occupancyData.reduce((s, d) => s + d.occupancy, 0) / occupancyData.length)
    : 0;
  const adr = totalBookings > 0 ? Math.round(totalRevenue / totalBookings) : 0;

  const handleSelectPreset = (preset: TimeRangePreset) => {
    setTimeRange(preset);
    setCustomRange({ startDate: "", endDate: "" });
  };

  const handleCustomRangeChange = (range: DateRange) => {
    setCustomRange(range);
    if (range.startDate && range.endDate) {
      setTimeRange("custom");
    }
  };

  return (
    <Tabs
      value={activeTab}
      onValueChange={(val) => setActiveTab(val as ViewTab)}
      className="flex flex-col gap-6 max-w-7xl mx-auto pb-10"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          eyebrow="Tahlil va Moliya"
          title="Biznes Hisobotlari"
          description="Moliyaviy holat, daromadlar dinamikasi, pul yechish va sotuvlar tahlili."
        />
        <TabsList>
          <TabsTrigger value="stats">Statistika</TabsTrigger>
          <TabsTrigger value="finance">Moliya & Pul yechish</TabsTrigger>
          <TabsTrigger value="detailed">To'liq Hisobot</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="stats">
        <ReportsStatsTab
          timeRange={timeRange}
          onSelectPreset={handleSelectPreset}
          customRange={customRange}
          onCustomRangeChange={handleCustomRangeChange}
          kpis={{
            revenue: totalRevenue,
            occupancy: avgOccupancy,
            adr,
            bookings: totalBookings,
          }}
          labels={labels}
          isBus={isBus}
          restaurant={restaurant}
          dacha={dacha}
          revenueData={revenueData}
          occupancyData={occupancyData}
          sourceDistribution={sourceDistribution}
          unitTypeDistribution={unitTypeDistribution}
          dachaSummary={dachaSummary}
        />
      </TabsContent>

      <TabsContent value="finance">
        <ReportsFinanceTab
          withdrawals={withdrawals}
          isLoading={financeLoading}
          isError={financeError}
          onRefetch={refetchWithdrawals}
          onSubmitWithdrawal={handleWithdrawalSubmit}
          monthRevenue={totalRevenue}
        />
      </TabsContent>

      <TabsContent value="detailed">
        <ReportsDetailedTab
          reservations={reservations}
          dateRange={customRange}
          onDateRangeChange={setCustomRange}
        />
      </TabsContent>
    </Tabs>
  );
}
