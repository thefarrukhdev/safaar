"use client";

import { BedDouble, Car, Home, LogIn, LogOut, UtensilsCrossed, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Card, CardBody } from "../../_components/ui/card";
import { Skeleton } from "../../_components/ui/skeleton";
import { OccupancyMeter } from "../../_components/domain/occupancy-meter";
import { formatMoney } from "../../_lib/utils/format";
import { cn } from "../../_lib/utils/cn";
import type { PartnerLabels } from "../../_lib/utils/partner-labels";
import type { FrontDeskStatsData } from "./types";

interface FrontDeskStatsProps {
  stats: FrontDeskStatsData;
  labels: PartnerLabels;
  isLoading?: boolean;
}

export function FrontDeskStats({ stats, labels, isLoading }: FrontDeskStatsProps) {
  const occupancyTitle = labels.isDacha
    ? "Dacha bandligi"
    : labels.isRestaurant
      ? "Stollar bandligi"
      : labels.isBus
        ? "Transport bandligi"
        : labels.isHostel
          ? "Yotoqlar bandligi"
          : "Bandlik ko'rsatkichi";

  const occupancyIcon = labels.isRestaurant ? (
    <UtensilsCrossed className="h-5 w-5" aria-hidden="true" />
  ) : labels.isBus ? (
    <Car className="h-5 w-5" aria-hidden="true" />
  ) : labels.isDacha ? (
    <Home className="h-5 w-5" aria-hidden="true" />
  ) : (
    <BedDouble className="h-5 w-5" aria-hidden="true" />
  );

  const arrivalsTitle = labels.isRestaurant
    ? "Bugungi bronlar"
    : labels.isBus
      ? "Olib ketishlar"
      : "Bugungi kelishlar";

  const arrivalsSubtext = labels.isRestaurant
    ? "Bugun keladigan mehmonlar"
    : labels.isBus
      ? "Bugun topshiriladigan avtomobillar"
      : "Bugun kutilayotgan mehmonlar";

  const departuresTitle = labels.isRestaurant
    ? "Yakunlangan bronlar"
    : labels.isBus
      ? "Qaytarishlar"
      : "Bugungi ketishlar";

  const departuresSubtext = labels.isRestaurant
    ? "Bugun yakunlanadigan stollar"
    : labels.isBus
      ? "Bugun qaytariladigan avtomobillar"
      : "Bugun chiqib ketadigan mehmonlar";

  return (
    <section
      aria-label="Asosiy ko'rsatkichlar"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {/* 1. Bandlik ko'rsatkichi */}
      <Card interactive className="group border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <CardBody className="p-5 flex flex-col justify-between h-full gap-3">
          <div>
            <div className="flex items-start justify-between gap-2">
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  {occupancyTitle}
                </span>
                {isLoading ? (
                  <Skeleton className="my-0.5 h-8 w-20" />
                ) : (
                  <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)] tabular-nums">
                    {stats.occupancyPercent}%
                  </span>
                )}
              </div>
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-brand-100 transition-transform duration-200 group-hover:scale-105 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-900/60">
                {occupancyIcon}
              </div>
            </div>
            <div className="mt-3">
              <OccupancyMeter percent={stats.occupancyPercent} size="md" showTicks showGlow />
            </div>
          </div>
          <div className="text-xs font-medium text-[var(--muted-foreground)] tabular-nums">
            {stats.totalRooms > 0 ? (
              <span>
                <strong className="font-semibold text-[var(--foreground)]">
                  {stats.occupiedRooms}
                </strong>{" "}
                / {stats.totalRooms} {labels.unitPlural} band
              </span>
            ) : (
              <span>{labels.unitPlural} mavjud emas</span>
            )}
          </div>
        </CardBody>
      </Card>

      {/* 2. Bugungi kelishlar */}
      <MetricCard
        title={arrivalsTitle}
        value={stats.arrivalsToday}
        subtext={arrivalsSubtext}
        icon={<LogIn className="h-5 w-5" aria-hidden="true" />}
        tone="emerald"
        isLoading={isLoading}
      />

      {/* 3. Bugungi ketishlar */}
      <MetricCard
        title={departuresTitle}
        value={stats.departuresToday}
        subtext={departuresSubtext}
        icon={<LogOut className="h-5 w-5" aria-hidden="true" />}
        tone="blue"
        isLoading={isLoading}
      />

      {/* 4. Oylik tushum */}
      <MetricCard
        title="Oylik tushum"
        value={formatMoney(stats.monthRevenue)}
        subtext="Joriy oy uchun daromad"
        icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
        tone="brand"
        isLoading={isLoading}
      />
    </section>
  );
}

interface MetricCardProps {
  title: string;
  value: string | number;
  subtext: string;
  icon: ReactNode;
  tone?: "brand" | "emerald" | "blue" | "amber";
  isLoading?: boolean;
}

const toneStyles = {
  brand:
    "bg-brand-50 text-brand-600 ring-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-900/60",
  emerald:
    "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60",
  blue:
    "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60",
  amber:
    "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60",
};

function MetricCard({
  title,
  value,
  subtext,
  icon,
  tone = "brand",
  isLoading,
}: MetricCardProps) {
  return (
    <Card interactive className="group border-[var(--border)] bg-[var(--surface)] shadow-sm">
      <CardBody className="p-5 flex flex-col justify-between h-full gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
              {title}
            </span>
            {isLoading ? (
              <Skeleton className="my-0.5 h-8 w-24" />
            ) : (
              <span className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)] tabular-nums">
                {value}
              </span>
            )}
          </div>
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105",
              toneStyles[tone],
            )}
          >
            {icon}
          </div>
        </div>
        <div className="text-xs font-medium text-[var(--muted-foreground)]">
          {subtext}
        </div>
      </CardBody>
    </Card>
  );
}
