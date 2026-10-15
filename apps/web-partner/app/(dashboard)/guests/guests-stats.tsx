"use client";

import { Crown, TrendingUp, Users, Wallet } from "lucide-react";
import { StatCard } from "../../_components/ui/stat-card";
import { formatMoney } from "../../_lib/utils/format";
import type { GuestStatsData } from "./types";

interface GuestsStatsProps {
  stats: GuestStatsData;
  vipOnly: boolean;
  onToggleVip: (val: boolean) => void;
  isLoading?: boolean;
}

export function GuestsStats({
  stats,
  vipOnly,
  onToggleVip,
  isLoading = false,
}: GuestsStatsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div>
        <StatCard
          label="Jami mijozlar"
          value={stats.totalGuests.toString()}
          hint="Bazada ro'yxatga olinganlar"
          icon={<Users className="h-5 w-5" />}
          tone="blue"
          isLoading={isLoading}
        />
      </div>

      <button
        type="button"
        onClick={() => onToggleVip(!vipOnly)}
        className="w-full text-left rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 transition-transform active:scale-[0.99] cursor-pointer"
        title={vipOnly ? "Barcha mijozlarni ko'rsatish" : "Faqat VIP mijozlarni ko'rsatish"}
        aria-label="Faqat VIP mijozlar filtri"
      >
        <StatCard
          label="VIP mijozlar"
          value={stats.vipGuests.toString()}
          hint={
            vipOnly ? (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                Faqat VIP ko'rsatilmoqda (faol filtr)
              </span>
            ) : (
              "Maxsus imtiyozli mehmonlar"
            )
          }
          icon={<Crown className="h-5 w-5" />}
          tone="amber"
          isLoading={isLoading}
          interactive
          className={vipOnly ? "ring-2 ring-amber-500/50" : undefined}
        />
      </button>

      <div>
        <StatCard
          label="O'rtacha tashriflar"
          value={`${stats.avgStays.toFixed(1)} marta`}
          hint="Har bir mijozga to'g'ri keluvchi"
          icon={<TrendingUp className="h-5 w-5" />}
          tone="neutral"
          isLoading={isLoading}
        />
      </div>

      <div>
        <StatCard
          label="Jami tushum"
          value={formatMoney(stats.totalRevenue)}
          hint="Mijozlar to'lagan jami summa"
          icon={<Wallet className="h-5 w-5" />}
          tone="emerald"
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
