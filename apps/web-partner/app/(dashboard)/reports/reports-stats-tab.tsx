"use client";

import {
  Activity,
  BedDouble,
  Calendar,
  CarFront,
  CreditCard,
  DollarSign,
  TrendingDown,
  TrendingUp,
  UtensilsCrossed,
} from "lucide-react";
import { Card, CardBody } from "../../_components/ui/card";
import { Button } from "../../_components/ui/button";
import { DateRangePicker, type DateRange } from "../../_components/ui/date-range-picker";
import { formatMoney } from "../../_lib/utils/format";
import type { PartnerLabels } from "../../_lib/utils/partner-labels";
import type { TimeRangePreset } from "./types";
import { cn } from "../../_lib/utils/cn";

interface ReportsStatsTabProps {
  timeRange: TimeRangePreset;
  onSelectPreset: (range: TimeRangePreset) => void;
  customRange: DateRange;
  onCustomRangeChange: (range: DateRange) => void;
  kpis: {
    revenue: number;
    occupancy: number;
    adr: number;
    bookings: number;
  };
  labels: PartnerLabels;
  isBus: boolean;
  restaurant: boolean;
  dacha: boolean;
  revenueData: Array<{ date: string; revenue: number; bookings: number }>;
  occupancyData: Array<{ date: string; occupancy: number }>;
  sourceDistribution: Array<{ name: string; value: number }>;
  unitTypeDistribution: Array<{ id: string; name: string; bookings: number; revenue: number }>;
  dachaSummary: { bookedNights: number; totalNights: number };
}

export function ReportsStatsTab({
  timeRange,
  onSelectPreset,
  customRange,
  onCustomRangeChange,
  kpis,
  labels,
  isBus,
  restaurant,
  dacha,
  revenueData,
  occupancyData,
  sourceDistribution,
  unitTypeDistribution,
  dachaSummary,
}: ReportsStatsTabProps) {
  const recentRevenue = revenueData.slice(-7).reverse();
  const recentOccupancy = occupancyData.slice(-7).reverse();

  // Max revenue for relative bar scaling in mini visualizer
  const maxRevenue = Math.max(...revenueData.map((d) => d.revenue), 1);

  return (
    <div className="flex flex-col gap-6">
      {/* 1. Vaqt va Sana Filtrlari (Presets + DateRangePicker) */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[var(--border)] bg-[var(--surface)] p-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            variant={timeRange === "7days" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onSelectPreset("7days")}
            className="text-xs font-semibold"
          >
            Oxirgi 7 kun
          </Button>
          <Button
            variant={timeRange === "30days" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onSelectPreset("30days")}
            className="text-xs font-semibold"
          >
            Oxirgi 30 kun
          </Button>
          <Button
            variant={timeRange === "year" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onSelectPreset("year")}
            className="text-xs font-semibold"
          >
            Joriy yil
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <DateRangePicker
            startDate={customRange.startDate}
            endDate={customRange.endDate}
            onChange={(r) => {
              onCustomRangeChange(r);
            }}
            placeholder="Ixtiyoriy sana oralig'i"
            align="right"
            showPresets
          />
        </div>
      </div>

      {/* 2. Asosiy ko'rsatkichlar (KPIs) */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ReportMetric
          label="Umumiy Daromad"
          value={formatMoney(kpis.revenue)}
          trend={{ value: 12, positive: true }}
          icon={<DollarSign className="h-6 w-6" />}
          tone="brand"
        />
        <ReportMetric
          label={isBus ? "O'rtacha Bandlik va Sig'im" : "O'rtacha Bandlik"}
          value={`${kpis.occupancy}%`}
          trend={{ value: 5, positive: true }}
          icon={<Activity className="h-6 w-6" />}
          tone="accent"
        />
        <ReportMetric
          label={
            isBus
              ? "O'rtacha ijara narxi"
              : restaurant
                ? "O'rtacha bron narxi"
                : "O'rtacha kunlik narx (ADR)"
          }
          value={formatMoney(kpis.adr)}
          trend={{ value: 2, positive: false }}
          icon={<CreditCard className="h-6 w-6" />}
          tone="warning"
        />
        <ReportMetric
          label={isBus ? "Yangi Ijara Bronlari" : "Yangi Bronlar"}
          value={kpis.bookings.toString()}
          trend={{ value: 8, positive: true }}
          icon={
            isBus ? (
              <CarFront className="h-6 w-6" />
            ) : restaurant ? (
              <UtensilsCrossed className="h-6 w-6" />
            ) : (
              <BedDouble className="h-6 w-6" />
            )
          }
          tone="success"
        />
      </section>

      {/* 3. Trend Grafik Vizualizatori (Visual Bar Charts) */}
      {revenueData.length > 0 && (
        <Card>
          <CardBody className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--border)] pb-4 mb-4">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Daromad dinamikasi va harakatlar
                </h2>
                <p className="text-xs text-[var(--muted-foreground)]">
                  Tanlangan davr bo'yicha kunlik daromad va bronlar grafigi
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-brand-600" />
                  Daromad (UZS)
                </span>
                <span className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                  Bronlar soni
                </span>
              </div>
            </div>

            {/* Elegant SVG/CSS Bar Timeline */}
            <div className="grid grid-cols-7 sm:grid-cols-14 md:grid-cols-30 gap-1.5 items-end h-40 pt-4 pb-2">
              {revenueData.slice(-14).map((d) => {
                const heightPercent = Math.max(8, Math.round((d.revenue / maxRevenue) * 100));
                return (
                  <div
                    key={d.date}
                    className="group relative flex flex-col items-center h-full justify-end"
                  >
                    {/* Tooltip on hover */}
                    <div className="pointer-events-none absolute bottom-full mb-2 hidden group-hover:flex flex-col items-center rounded-lg bg-zinc-900 px-2.5 py-1.5 text-[11px] text-white shadow-xl z-20 whitespace-nowrap dark:bg-zinc-800">
                      <span className="font-semibold">{formatShortDate(d.date)}</span>
                      <span>{formatMoney(d.revenue)}</span>
                      <span className="text-emerald-400">{d.bookings} ta bron</span>
                    </div>

                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full rounded-t-md bg-gradient-to-t from-brand-600 to-brand-400 group-hover:from-brand-500 group-hover:to-brand-300 transition-all cursor-pointer"
                    />
                    <span className="text-[10px] text-zinc-400 mt-1 font-mono">
                      {d.date.slice(8, 10)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardBody>
        </Card>
      )}

      {/* 4. Daromad va Bandlik jadvallari */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardBody className="p-6 flex-1 flex flex-col">
            <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Oxirgi kunlar daromadi
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  Kunlik tushumlar va bronlar soni
                </p>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 px-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                <span>Sana</span>
                <span className="text-right w-16">Bronlar</span>
                <span className="text-right w-24">Daromad</span>
              </div>

              {recentRevenue.map((d) => (
                <div
                  key={d.date}
                  className="grid grid-cols-[1fr_auto_auto] gap-4 py-2.5 px-1 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)] transition-colors rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-200">
                      {formatShortDate(d.date)}
                    </span>
                  </div>
                  <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 text-right w-16">
                    {d.bookings} ta
                  </span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 text-right w-24">
                    {formatMoney(d.revenue)}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="flex flex-col">
          <CardBody className="p-6 flex-1 flex flex-col">
            <div className="mb-4 flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Oxirgi kunlar bandligi
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  {labels.unitPlural.charAt(0).toUpperCase() + labels.unitPlural.slice(1)} qanchalik to'lganligi
                </p>
              </div>
            </div>

            <div className="flex flex-col">
              <div className="grid grid-cols-[1fr_auto] gap-4 py-2 px-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                <span>Sana</span>
                <span className="text-right">To'liqlik (%)</span>
              </div>

              {recentOccupancy.map((d) => (
                <div
                  key={d.date}
                  className="grid grid-cols-[1fr_auto] gap-4 py-2.5 px-1 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)] transition-colors rounded-md"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-zinc-400" />
                    <span className="text-xs font-medium text-zinc-900 dark:text-zinc-200">
                      {formatShortDate(d.date)}
                    </span>
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <span
                      className={cn(
                        "text-xs font-bold text-right",
                        d.occupancy >= 80
                          ? "text-emerald-600 dark:text-emerald-400"
                          : d.occupancy >= 50
                            ? "text-amber-600 dark:text-amber-400"
                            : "text-red-600 dark:text-red-400",
                      )}
                    >
                      {d.occupancy}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* 5. Sotuv manbalari va Top toifalar */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="flex flex-col">
          <CardBody className="p-6 flex-1 flex flex-col">
            <div className="mb-4 border-b border-[var(--border)] pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Sotuv manbalari
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                Mehmonlar qaysi kanallar orqali bron qilmoqda?
              </p>
            </div>

            <div className="flex flex-col">
              <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 px-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                <span>Manba</span>
                <span className="text-right w-16">Ulush</span>
                <span className="text-right w-16">Bronlar</span>
              </div>

              {(() => {
                const totalSrc = sourceDistribution.reduce((s, r) => s + r.value, 0);
                const sortedSrc = [...sourceDistribution].sort((a, b) => b.value - a.value).slice(0, 5);

                return sortedSrc.map((s) => {
                  const pct = totalSrc ? Math.round((s.value / totalSrc) * 100) : 0;
                  return (
                    <div
                      key={s.name}
                      className="grid grid-cols-[1fr_auto_auto] gap-4 py-2.5 px-1 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)] transition-colors rounded-md"
                    >
                      <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                        {s.name}
                      </span>
                      <span className="text-xs font-medium text-zinc-500 text-right w-16">
                        {pct}%
                      </span>
                      <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100 text-right w-16">
                        {s.value} ta
                      </span>
                    </div>
                  );
                });
              })()}
            </div>
          </CardBody>
        </Card>

        {dacha ? (
          <Card>
            <CardBody className="p-6">
              <div className="mb-4 border-b border-[var(--border)] pb-3">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Bandlik holati
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  Oxirgi {dachaSummary.totalNights} kunda dacha qanchalik band bo'lgan
                </p>
              </div>
              <div className="flex items-center gap-6 py-4">
                <div>
                  <p className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                    {dachaSummary.bookedNights}/{dachaSummary.totalNights}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                    kun band bo'lgan
                  </p>
                </div>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-brand-600 transition-all duration-500"
                    style={{
                      width: `${
                        dachaSummary.totalNights > 0
                          ? Math.round((dachaSummary.bookedNights / dachaSummary.totalNights) * 100)
                          : 0
                      }%`,
                    }}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardBody className="p-6">
              <div className="mb-4 border-b border-[var(--border)] pb-3">
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Top {labels.unitTypeLabel.toLowerCase()}lari (Daromad bo'yicha)
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  Eng ko'p foyda keltiruvchi variantlar
                </p>
              </div>

              <div className="flex flex-col">
                <div className="grid grid-cols-[auto_1fr_auto] gap-4 py-2 px-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
                  <span className="w-6 text-center">#</span>
                  <span>{labels.unitTypeLabel}</span>
                  <span className="text-right">Daromad</span>
                </div>

                {unitTypeDistribution.length === 0 ? (
                  <p className="py-4 text-xs text-zinc-500 dark:text-zinc-400">
                    Hali bronlar yo'q.
                  </p>
                ) : (
                  [...unitTypeDistribution]
                    .sort((a, b) => b.revenue - a.revenue)
                    .slice(0, 5)
                    .map((r, index) => (
                      <div
                        key={r.id}
                        className="grid grid-cols-[auto_1fr_auto] gap-4 py-2.5 px-1 border-b border-[var(--border)] last:border-0 hover:bg-[var(--surface-muted)] transition-colors rounded-md"
                      >
                        <span className="text-xs font-mono text-zinc-400 w-6 text-center">
                          {index + 1}
                        </span>
                        <div className="flex flex-col">
                          <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                            {r.name}
                          </span>
                          <span className="text-[11px] text-zinc-500 mt-0.5">
                            {r.bookings} ta bron
                          </span>
                        </div>
                        <span className="text-xs font-bold text-zinc-900 dark:text-white text-right self-center">
                          {formatMoney(r.revenue)}
                        </span>
                      </div>
                    ))
                )}
              </div>
            </CardBody>
          </Card>
        )}
      </div>
    </div>
  );
}

function formatShortDate(isoDate: string) {
  const d = new Date(isoDate);
  const months = [
    "Yan",
    "Fev",
    "Mar",
    "Apr",
    "May",
    "Iyun",
    "Iyul",
    "Avg",
    "Sen",
    "Okt",
    "Noy",
    "Dek",
  ];
  return `${d.getDate()}-${months[d.getMonth()]}`;
}

interface ReportMetricProps {
  label: string;
  value: string;
  trend?: { value: number; positive: boolean };
  icon: React.ReactNode;
  tone?: "brand" | "accent" | "warning" | "success" | "danger" | "neutral";
}

function ReportMetric({
  label,
  value,
  trend,
  icon,
  tone = "brand",
}: ReportMetricProps) {
  const toneMap = {
    neutral: { bg: "bg-zinc-100 dark:bg-zinc-800/60", icon: "text-zinc-500" },
    brand: { bg: "bg-brand-50 dark:bg-brand-900/20", icon: "text-brand-600 dark:text-brand-400" },
    accent: { bg: "bg-indigo-50 dark:bg-indigo-900/20", icon: "text-indigo-600 dark:text-indigo-400" },
    warning: { bg: "bg-amber-50 dark:bg-amber-900/20", icon: "text-amber-600 dark:text-amber-400" },
    success: { bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: "text-emerald-600 dark:text-emerald-400" },
    danger: { bg: "bg-red-50 dark:bg-red-900/20", icon: "text-red-600 dark:text-red-400" },
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-card bg-[var(--surface)] p-5 border border-[var(--border)] shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-[var(--muted-foreground)]">{label}</p>
          <p className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white">{value}</p>
        </div>
        <div
          className={cn(
            "flex h-11 w-11 items-center justify-center rounded-xl",
            toneMap.bg,
            toneMap.icon,
          )}
        >
          {icon}
        </div>
      </div>

      {trend && (
        <div className="mt-4 flex items-center gap-2">
          <div
            className={cn(
              "flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md",
              trend.positive
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400",
            )}
          >
            {trend.positive ? (
              <TrendingUp className="h-3.5 w-3.5" />
            ) : (
              <TrendingDown className="h-3.5 w-3.5" />
            )}
            {trend.value}%
          </div>
          <span className="text-[11px] text-[var(--muted-foreground)]">
            o'tgan davrga nisbatan
          </span>
        </div>
      )}
    </div>
  );
}
