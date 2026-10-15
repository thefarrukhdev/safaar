"use client";

import { AlertCircle, CheckCircle2, MessageSquare, Star, ThumbsUp } from "lucide-react";
import { StatCard } from "../../_components/ui/stat-card";
import type { ReviewStatsData } from "./types";

interface ReviewsStatsProps {
  stats: ReviewStatsData;
  isLoading?: boolean;
}

export function ReviewsStats({ stats, isLoading = false }: ReviewsStatsProps) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div>
        <StatCard
          icon={<Star className="h-5 w-5 text-amber-500 fill-amber-500/20" />}
          label="O'rtacha reyting"
          value={stats.totalReviews > 0 ? `${stats.averageRating.toFixed(1)} / 5.0` : "—"}
          hint={stats.totalReviews > 0 ? "Barcha sharhlar o'rtachasi" : "Hali sharhlar yo'q"}
          tone="amber"
          isLoading={isLoading}
        />
      </div>

      <div>
        <StatCard
          icon={<MessageSquare className="h-5 w-5 text-blue-600" />}
          label="Jami sharhlar"
          value={stats.totalReviews.toString()}
          hint="Mijozlar qoldirgan mulohazalar"
          tone="blue"
          isLoading={isLoading}
        />
      </div>

      <div>
        <StatCard
          icon={<ThumbsUp className="h-5 w-5 text-emerald-600" />}
          label="Ijobiy sharhlar ulushi"
          value={`${stats.positivePercentage}%`}
          hint="4 va 5 yulduzli baholar"
          tone="emerald"
          isLoading={isLoading}
        />
      </div>

      <div>
        <StatCard
          icon={
            stats.unansweredCount > 0 ? (
              <AlertCircle className="h-5 w-5 text-amber-600" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            )
          }
          label="Javob kutilmoqda"
          value={stats.unansweredCount.toString()}
          hint={
            stats.unansweredCount > 0 ? (
              <span className="font-semibold text-amber-600 dark:text-amber-400">
                Mijozga javob yozish kerak!
              </span>
            ) : (
              "Barcha sharhlarga javob berilgan"
            )
          }
          tone={stats.unansweredCount > 0 ? "amber" : "neutral"}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
}
