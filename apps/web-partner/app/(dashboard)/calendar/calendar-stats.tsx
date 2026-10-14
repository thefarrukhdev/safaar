"use client";

import { Building2, CalendarCheck2, CheckCircle2, Wallet } from "lucide-react";
import { StatCard } from "../../_components/ui/stat-card";
import { formatMoney } from "../../_lib/utils/format";
import type { CalendarPeriodStats } from "./types";

interface CalendarStatsProps {
  stats: CalendarPeriodStats;
  periodLabel: string;
  availabilityLabel: string;
  isLoading?: boolean;
}

export function CalendarStats({
  stats,
  periodLabel,
  availabilityLabel,
  isLoading = false,
}: CalendarStatsProps) {
  const listedPercent = stats.totalRows > 0 ? Math.round((stats.listedRows / stats.totalRows) * 100) : 0;

  return (
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Kalendar statistikasi">
      <StatCard
        label={availabilityLabel}
        value={`${stats.listedRows} / ${stats.totalRows}`}
        hint={`${listedPercent}% turistlarga sotuvda ochiq`}
        icon={<Building2 className="h-5 w-5" aria-hidden="true" />}
        tone="brand"
        isLoading={isLoading}
      />
      <StatCard
        label="Davrdagi bandlik"
        value={`${stats.occupancyRate}%`}
        hint={`${stats.bookings} ta faol bron (${periodLabel})`}
        icon={<CalendarCheck2 className="h-5 w-5" aria-hidden="true" />}
        tone="emerald"
        isLoading={isLoading}
      />
      <StatCard
        label="Oldindan to'langan"
        value={formatMoney(stats.paid)}
        hint={`Jami tushum: ${formatMoney(stats.total)}`}
        icon={<CheckCircle2 className="h-5 w-5" aria-hidden="true" />}
        tone="blue"
        isLoading={isLoading}
      />
      <StatCard
        label="Qoldiq to'lov"
        value={formatMoney(stats.balance)}
        hint={
          stats.balance > 0
            ? "Kelganda yoki chiqishda undiriladi"
            : "Barcha to'lovlar to'liq qoplangan"
        }
        icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
        tone={stats.balance > 0 ? "amber" : "neutral"}
        isLoading={isLoading}
      />
    </section>
  );
}
