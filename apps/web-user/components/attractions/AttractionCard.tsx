"use client";

import { Star, Clock } from "lucide-react";
import { UniversalCard } from "@/components/ui/UniversalCard";
import type { AttractionItem } from "@/components/catalog/types";

interface AttractionCardProps {
  item: AttractionItem;
  categoryLabel: string;
  index: number;
  locale: string;
  onHover?: (hovering: boolean) => void;
}

const CATEGORY_STYLES: Record<string, { dot: string }> = {
  historical: {
    dot: "bg-slate-500",
  },
  unesco: {
    dot: "bg-blue-600",
  },
  nature: {
    dot: "bg-slate-500",
  },
};

export function AttractionCard({ item, categoryLabel, index, locale, onHover }: AttractionCardProps) {
  const catStyle = CATEGORY_STYLES[item.categoryKey] ?? CATEGORY_STYLES.historical;

  return (
    <div
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className="h-full animate-in fade-in slide-in-from-bottom-4 duration-500 fill-mode-both"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <UniversalCard
        href={`/${locale}/attractions/${item.id}`}
        imageSrc={item.imageUrl}
        imageAlt={item.name}
        showFavorite={true}
        topLeft={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-[11px] sm:text-xs font-medium text-slate-900 shadow-sm">
            <span className={`h-1.5 w-1.5 rounded-full ${catStyle.dot}`} />
            {categoryLabel}
          </span>
        }
        title={
          <div className="flex items-start justify-between gap-2">
            <span className="truncate">{item.name}</span>
            {item.rating > 0 && (
              <div className="flex shrink-0 items-center gap-1 text-[13px] sm:text-sm font-semibold">
                <Star className="h-3.5 w-3.5 fill-slate-900 text-slate-900" />
                <span className="text-slate-900">{item.rating.toFixed(1)}</span>
              </div>
            )}
          </div>
        }
        location={item.cityName}
        extraInfo={
          item.bestTimeToVisit ? (
            <p className="mt-1 flex items-center gap-1.5 text-xs sm:text-sm text-slate-500">
              <Clock className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{item.bestTimeToVisit}</span>
            </p>
          ) : null
        }
      />
    </div>
  );
}
