"use client";

import { ArrowUpDown, Crown, RotateCcw, Search, X } from "lucide-react";
import { Input } from "../../_components/ui/input";
import { Button } from "../../_components/ui/button";
import type { SortOption } from "./types";

interface GuestsFiltersProps {
  query: string;
  onQueryChange: (q: string) => void;
  vipOnly: boolean;
  onVipToggle: (vip: boolean) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  vipCount: number;
  guestPlural: string;
  onReset: () => void;
}

export function GuestsFilters({
  query,
  onQueryChange,
  vipOnly,
  onVipToggle,
  sortBy,
  onSortChange,
  vipCount,
  guestPlural,
  onReset,
}: GuestsFiltersProps) {
  const isFiltered = Boolean(query.trim() || vipOnly);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-[var(--border)] bg-[var(--surface)] p-3">
      {/* Qidiruv va VIP filtrlari */}
      <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Ism, telefon yoki email bo'yicha qidirish..."
            className="pl-9 pr-8 h-9 text-sm"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label={`${guestPlural} ichidan qidirish`}
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

        <button
          type="button"
          onClick={() => onVipToggle(!vipOnly)}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            vipOnly
              ? "border-amber-400 bg-amber-50 text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-300"
              : "border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] text-[var(--foreground)]"
          }`}
          aria-pressed={vipOnly}
        >
          <Crown
            className={`h-3.5 w-3.5 ${
              vipOnly ? "text-amber-600 dark:text-amber-400 fill-amber-500/20" : "text-amber-500"
            }`}
            aria-hidden
          />
          <span>Faqat VIP</span>
          {vipCount > 0 && (
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                vipOnly
                  ? "bg-amber-200 text-amber-900 dark:bg-amber-900 dark:text-amber-200"
                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {vipCount}
            </span>
          )}
        </button>

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

      {/* Saralash boshqaruvi */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
          <ArrowUpDown className="h-3.5 w-3.5" aria-hidden />
          <span>Saralash:</span>
        </div>
        <select
          aria-label="Mijozlarni saralash"
          value={sortBy}
          onChange={(e) => onSortChange(e.target.value as SortOption)}
          className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2.5 text-xs font-medium focus:border-brand-600 focus:outline-none"
        >
          <option value="stays-desc">Tashriflar soni (ko'pdan kamga)</option>
          <option value="spent-desc">Sarflangan summa (yuqoridan pastga)</option>
          <option value="last-stay-desc">Oxirgi tashrif (yaqindan uzoqqa)</option>
          <option value="name-asc">Ism (A → Z)</option>
          <option value="name-desc">Ism (Z → A)</option>
        </select>
      </div>
    </div>
  );
}
