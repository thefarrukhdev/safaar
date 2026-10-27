"use client";

import {
  CalendarCheck,
  CalendarRange,
  Clock3,
  Wallet,
} from "lucide-react";
import { BookingStatus } from "@safaar/types";
import { StatCard } from "../../_components/ui/stat-card";
import { formatMoney } from "../../_lib/utils/format";
import type { PartnerLabels } from "../../_lib/utils/partner-labels";
import type { FilterKey, ReservationStatsData } from "./types";

interface ReservationsStatsProps {
  stats: ReservationStatsData;
  labels: PartnerLabels;
  activeFilter: FilterKey;
  isLoading?: boolean;
  onSelectFilter: (filter: FilterKey) => void;
  onSelectToday: () => void;
}

export function ReservationsStats({
  stats,
  labels,
  activeFilter,
  isLoading = false,
  onSelectFilter,
  onSelectToday,
}: ReservationsStatsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <button
        type="button"
        onClick={() => onSelectFilter("all")}
        className="w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 transition-transform active:scale-[0.99] cursor-pointer"
        title="Barcha faol bronlarni ko'rish"
        aria-label="Barcha faol bronlarni ko'rish"
      >
        <StatCard
          label="Faol bronlar"
          value={stats.active.toString()}
          hint="Bekor va yakunlanganlardan tashqari"
          icon={<CalendarRange className="h-5 w-5" />}
          tone="blue"
          isLoading={isLoading}
          interactive
          className={activeFilter === "all" ? "ring-2 ring-blue-500/50" : undefined}
        />
      </button>

      <button
        type="button"
        onClick={() => onSelectFilter(BookingStatus.PENDING)}
        className="w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-transform active:scale-[0.99] cursor-pointer"
        title="Javob kutilayotgan yangi bronlarni ko'rish"
        aria-label="Javob kutilayotgan yangi bronlarni ko'rish"
      >
        <StatCard
          label="Javob kutilmoqda"
          value={stats.pending.toString()}
          hint={
            stats.pending > 0 ? (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                Tez tasdiqlash kerak!
              </span>
            ) : (
              "Yangi so'rovlar yo'q"
            )
          }
          icon={<Clock3 className="h-5 w-5" />}
          tone={stats.pending > 0 ? "amber" : "neutral"}
          isLoading={isLoading}
          interactive
          className={activeFilter === BookingStatus.PENDING ? "ring-2 ring-amber-500/50" : undefined}
        />
      </button>

      <button
        type="button"
        onClick={onSelectToday}
        className="w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 transition-transform active:scale-[0.99] cursor-pointer"
        title={`Bugun kelishi kutilayotgan ${labels.guestLabel.toLowerCase()}larni ko'rish`}
        aria-label={`Bugun kelishi kutilayotgan ${labels.guestLabel.toLowerCase()}larni ko'rish`}
      >
        <StatCard
          label={labels.isBus ? "Bugungi olib ketishlar" : labels.isRestaurant ? "Bugungi tashriflar" : "Bugungi kelishlar"}
          value={stats.arrivalsToday.toString()}
          hint={`${labels.checkInActionLabel ?? labels.checkInLabel} uchun tayyor`}
          icon={<CalendarCheck className="h-5 w-5" />}
          tone="emerald"
          isLoading={isLoading}
          interactive
        />
      </button>

      <div>
        <StatCard
          label="Kutilayotgan to'lov"
          value={formatMoney(stats.unpaid)}
          hint={
            stats.unpaid > 0 ? (
              <span className="font-semibold text-red-600 dark:text-red-400">
                Mijozlardan qoldiq to'lov
              </span>
            ) : (
              "Qarzdorlik mavjud emas"
            )
          }
          icon={<Wallet className="h-5 w-5" />}
          tone={stats.unpaid > 0 ? "amber" : "emerald"}
          isLoading={isLoading}
          interactive={false}
        />
      </div>
    </div>
  );
}
