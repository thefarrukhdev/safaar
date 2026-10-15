"use client";

import { ArrowUpDown, RotateCcw, Search, X } from "lucide-react";
import { Button } from "../../_components/ui/button";
import { Input } from "../../_components/ui/input";
import type { ReviewFilterKey, ReviewSortOption, ReviewStatsData } from "./types";

interface ReviewsFiltersProps {
  query: string;
  onQueryChange: (q: string) => void;
  activeFilter: ReviewFilterKey;
  onSelectFilter: (filter: ReviewFilterKey) => void;
  sortBy: ReviewSortOption;
  onSortChange: (sort: ReviewSortOption) => void;
  stats: ReviewStatsData;
  onReset: () => void;
}

export function ReviewsFilters({
  query,
  onQueryChange,
  activeFilter,
  onSelectFilter,
  sortBy,
  onSortChange,
  stats,
  onReset,
}: ReviewsFiltersProps) {
  const isFiltered = Boolean(query.trim() || activeFilter !== "all");

  const filterOptions: Array<{ key: ReviewFilterKey; label: string; count?: number; badgeTone?: string }> = [
    { key: "all", label: "Barchasi", count: stats.totalReviews },
    { key: "5star", label: "⭐ 5 yulduz", count: stats.starCounts[5] },
    { key: "4star", label: "⭐ 4 yulduz", count: stats.starCounts[4] },
    {
      key: "critical",
      label: "⭐ 1-3 yulduz",
      count: stats.starCounts[3] + stats.starCounts[2] + stats.starCounts[1],
    },
    {
      key: "unanswered",
      label: "Javob berilmagan",
      count: stats.unansweredCount,
      badgeTone: "amber",
    },
    { key: "answered", label: "Javob berilgan" },
  ];

  return (
    <div className="flex flex-col gap-3 rounded-card border border-[var(--border)] bg-[var(--surface)] p-3">
      {/* 1. Qidiruv va Saralash */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1 min-w-[240px]">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Sharh matni yoki mijoz ismi bo'yicha..."
            className="pl-9 pr-8 h-9 text-xs"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
          />
          {query && (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              aria-label="Qidiruvni tozalash"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
            <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
            <span>Saralash:</span>
          </div>
          <select
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value as ReviewSortOption)}
            className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium focus:border-brand-600 focus:outline-none"
            aria-label="Sharhlarni saralash"
          >
            <option value="newest">Eng yangi sharhlar</option>
            <option value="highest">Yuqori bahodan pastga</option>
            <option value="lowest">Past bahodan yuqoriga</option>
          </select>

          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onReset}
              className="h-9 gap-1 text-xs text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              <span>Tozalash</span>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Tezkor Filter Tugmalari */}
      <div className="flex flex-wrap items-center gap-1.5 border-t border-[var(--border)] pt-2.5">
        {filterOptions.map((opt) => {
          const isSelected = activeFilter === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => onSelectFilter(opt.key)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors cursor-pointer ${
                isSelected
                  ? "border-brand-600 bg-brand-50 text-brand-900 dark:border-brand-500 dark:bg-brand-950/60 dark:text-brand-200 font-semibold shadow-xs"
                  : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--foreground)]"
              }`}
            >
              <span>{opt.label}</span>
              {typeof opt.count === "number" && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-semibold ${
                    isSelected
                      ? "bg-brand-200 text-brand-900 dark:bg-brand-900 dark:text-brand-200"
                      : opt.badgeTone === "amber" && opt.count > 0
                        ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  }`}
                >
                  {opt.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
