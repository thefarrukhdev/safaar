"use client";

import { BedDouble, Car, Home, LogIn, LogOut, UtensilsCrossed, Wallet } from "lucide-react";
import { StatCard } from "../../_components/ui/stat-card";
import { OccupancyMeter } from "../../_components/domain/occupancy-meter";
import { formatMoney } from "../../_lib/utils/format";
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

  const occupancyHint =
    stats.totalRooms > 0 ? (
      <span>
        <strong className="font-semibold text-[var(--foreground)]">
          {stats.occupiedRooms}
        </strong>{" "}
        / {stats.totalRooms} {labels.unitPlural} band
      </span>
    ) : (
      <span>{labels.unitPlural} mavjud emas</span>
    );

  return (
    <section
      aria-label="Asosiy ko'rsatkichlar"
      className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
    >
      {/* 1. Bandlik ko'rsatkichi */}
      <StatCard
        label={occupancyTitle}
        value={`${stats.occupancyPercent}%`}
        hint={occupancyHint}
        icon={occupancyIcon}
        tone="brand"
        isLoading={isLoading}
      >
        <div className="mt-3">
          <OccupancyMeter
            percent={stats.occupancyPercent}
            size="md"
            showTicks
            showGlow
          />
        </div>
      </StatCard>

      {/* 2. Bugungi kelishlar */}
      <StatCard
        label={arrivalsTitle}
        value={stats.arrivalsToday}
        hint={arrivalsSubtext}
        icon={<LogIn className="h-5 w-5" aria-hidden="true" />}
        tone="emerald"
        isLoading={isLoading}
      />

      {/* 3. Bugungi ketishlar */}
      <StatCard
        label={departuresTitle}
        value={stats.departuresToday}
        hint={departuresSubtext}
        icon={<LogOut className="h-5 w-5" aria-hidden="true" />}
        tone="blue"
        isLoading={isLoading}
      />

      {/* 4. Oylik tushum */}
      <StatCard
        label="Oylik tushum"
        value={formatMoney(stats.monthRevenue)}
        hint="Joriy oy uchun daromad"
        icon={<Wallet className="h-5 w-5" aria-hidden="true" />}
        tone="brand"
        isLoading={isLoading}
      />
    </section>
  );
}
