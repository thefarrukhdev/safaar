"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import { Map, X, SlidersHorizontal, Search, Compass, Sparkles, LayoutGrid, MapPin } from "lucide-react";
import { gsap } from "gsap";
import { AttractionCard } from "@/components/attractions/AttractionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import type { AttractionItem } from "@/components/catalog/types";
import type { CatalogDict } from "@/i18n/dictionaries";

// ─── SHIMMER SKELETON (Design System: Sweep, not Pulse) ──────────────────────
function ShimmerCard() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="aspect-[4/3] w-full animate-shimmer bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%]" />
      <div className="p-4 space-y-2">
        <div className="h-4 w-3/4 rounded-full animate-shimmer bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%]" />
        <div className="h-3 w-1/2 rounded-full animate-shimmer bg-gradient-to-r from-slate-100 via-slate-200 to-slate-100 bg-[length:200%_100%]" />
      </div>
    </div>
  );
}

// ─── STICKY GLASSMORPHIC FILTER HEADER ───────────────────────────────────────
function FilterHeader({
  query,
  onQueryChange,
  selectedCategory,
  onCategoryChange,
  categories,
  onOpenFilters,
  totalCount,
  dict,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  selectedCategory: string;
  onCategoryChange: (v: string) => void;
  categories: { id: string; label: string }[];
  onOpenFilters: () => void;
  totalCount: number;
  dict: CatalogDict["attractions"];
}) {
  return (
    <div className="sticky top-0 z-20 border-b border-white/40 bg-white/72 backdrop-blur-md dark:border-slate-800/50 dark:bg-slate-950/72 transition-all duration-500">
      {/* Top row */}
      <div className="flex items-center justify-between gap-3 px-4 pt-3 pb-2 sm:px-6">
        <div className="flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary-600 transition-colors duration-500" />
          <div>
            <span className="text-sm font-black text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
              {dict.title}
            </span>
            {/* Live count — Lapis Blue accent (Design System info color) */}
            <span className="ml-2 rounded-full bg-[#3B55C8]/10 px-2 py-0.5 text-[10px] font-bold text-[#3B55C8] dark:bg-[#3B55C8]/20 dark:text-[#7F96E8]">
              {totalCount} ta
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenFilters}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 shadow-sm"
            aria-label="Filtrlar"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Search Input */}
      <div className="relative px-4 pb-2 sm:px-6">
        <Search className="absolute left-7 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 sm:left-9" />
        <Input
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          placeholder="Nom yoki shahar bo'yicha qidirish..."
          className="pl-10 text-sm"
        />
      </div>

      {/* Category Chips — Silk Road palette per category */}
      <div className="flex gap-2 overflow-x-auto px-4 pb-3 pt-0 scrollbar-none sm:px-6">
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => onCategoryChange(cat.id)}
              className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-bold transition-all duration-200 ${
                isActive
                  ? "bg-primary-600 text-white shadow-md"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-primary-300 hover:text-primary-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-primary-600"
              }`}
            >
              {cat.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ─── MAP PLACEHOLDER (Warm Neutral tints from design system) ─────────────────
function MapPlaceholder({ dict }: { dict: CatalogDict["attractions"] }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 m-4 rounded-xl border-2 border-dashed border-slate-200/80 bg-[#F8FAF9] dark:border-slate-700/60 dark:bg-slate-900/40">
      {/* Jade soft glow behind icon */}
      <div className="relative flex h-20 w-20 items-center justify-center rounded-xl bg-primary-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_rgba(5,150,105,0.12)] dark:bg-primary-900/20">
        <Map className="h-9 w-9 text-primary-600 dark:text-primary-400" />
      </div>
      <div className="text-center">
        <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{(dict as any).map?.title || "Interaktiv xarita"}</p>
        <p className="mt-1 flex items-center justify-center gap-1 text-xs text-slate-400">
          <MapPin className="h-3 w-3" />
          {(dict as any).map?.soon || "Tez orada ulanadi"}
        </p>
      </div>
    </div>
  );
}

// ─── MOBILE BOTTOM SHEET ──────────────────────────────────────────────────────
function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!sheetRef.current) return;
    if (open) {
      document.body.style.overflow = "hidden";
      gsap.fromTo(
        sheetRef.current,
        { y: "100%" },
        { y: "0%", duration: 0.38, ease: "power3.out" },
      );
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  const handleClose = () => {
    if (!sheetRef.current) return onClose();
    gsap.to(sheetRef.current, {
      y: "100%",
      duration: 0.28,
      ease: "power3.in",
      onComplete: onClose,
    });
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/45 backdrop-blur-[2px] md:hidden"
        aria-hidden
        onClick={handleClose}
      />
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-slate-200 bg-white shadow-[0_-8px_32px_rgba(0,0,0,0.12)] dark:border-slate-700 dark:bg-slate-950 md:hidden"
        style={{ transform: "translateY(100%)" }}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="h-1 w-10 rounded-full bg-slate-200 dark:bg-slate-700" />
        </div>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-3 pt-1 dark:border-slate-800">
          <span className="text-sm font-black text-slate-900 dark:text-white">{title}</span>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
            aria-label="Yopish"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </>
  );
}

// ─── MAIN VIEW ────────────────────────────────────────────────────────────────
export function AttractionsView({
  dict,
  items,
}: {
  dict: CatalogDict["attractions"];
  items: AttractionItem[];
}) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const categories = useMemo(
    () => [
      { id: "all", label: dict.categories?.all ?? dict.allPlaces },
      { id: "historical", label: dict.categories?.historical },
      { id: "unesco", label: dict.categories?.unesco },
      { id: "nature", label: dict.categories?.nature },
    ],
    [dict],
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return items.filter((item) => {
      const matchQ =
        item.name.toLowerCase().includes(q) ||
        item.cityName.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      const matchCat = selectedCategory === "all" || item.categoryKey === selectedCategory;
      return matchQ && matchCat;
    });
  }, [items, query, selectedCategory]);

  return (
    <div className="mx-auto flex h-[calc(100svh-56px)] w-full max-w-7xl bg-slate-50 px-4 sm:px-6 dark:bg-[#080E0D] md:h-[calc(100svh-72px)]">

      {/* ── LEFT: Scrollable List Panel ────────────────────────── */}
      <div className="flex w-full flex-col overflow-hidden md:w-1/2 md:pr-4">
        <FilterHeader
          query={query}
          onQueryChange={setQuery}
          selectedCategory={selectedCategory}
          onCategoryChange={setSelectedCategory}
          categories={categories}
          onOpenFilters={() => setFiltersOpen(true)}
          totalCount={filtered.length}
          dict={dict}
        />

        {/* Card Grid */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Compass className="h-6 w-6" />}
              title={(dict as any).empty?.title || "Ma'lumot topilmadi"}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filtered.map((item, index) => (
                <AttractionCard
                  key={item.id}
                  item={item}
                  categoryLabel={dict.categories?.[item.categoryKey] ?? item.categoryDefault}
                  index={index}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Sticky Map Panel (Desktop) ──────────────────── */}
      <div className="hidden w-1/2 overflow-hidden border-l border-slate-200/70 dark:border-slate-800 md:flex md:flex-col">
        <div className="sticky top-0 h-full">
          <MapPlaceholder dict={dict} />
        </div>
      </div>

      {/* ── MOBILE FAB: Show Map — Jade Push Button ─────────────── */}
      <button
        type="button"
        onClick={() => setMapOpen(true)}
        className="fixed bottom-6 left-1/2 z-30 -translate-x-1/2 inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white
          shadow-lg
          transition-all duration-200
          hover:-translate-y-0.5 hover:-translate-x-1/2
          hover:shadow-xl
          active:translate-y-0 active:-translate-x-1/2
          active:shadow-md
          md:hidden"
      >
        <Map className="h-4 w-4" />
        {(dict as any).map?.show || "Xaritada ko'rish"}
      </button>

      {/* ── MOBILE BOTTOM SHEET: Filters ──────────────────────── */}
      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={(dict as any).filters?.title || "Filtrlar"}>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => { setSelectedCategory(cat.id); setFiltersOpen(false); }}
              className={`rounded-full px-4 py-2.5 text-sm font-bold transition-all ${
                selectedCategory === cat.id
                  ? "bg-primary-600 text-white shadow-sm"
                  : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-primary-300 hover:text-primary-700"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* ── MOBILE BOTTOM SHEET: Map ──────────────────────────── */}
      <BottomSheet open={mapOpen} onClose={() => setMapOpen(false)} title={(dict as any).map?.title || "Xarita"}>
        <div className="flex h-[42vh] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-[#F8FAF9]">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-50">
            <Map className="h-7 w-7 text-primary-600" />
          </div>
          <p className="text-sm font-bold text-slate-600">{(dict as any).map?.soon || "Xarita tez orada ulanadi"}</p>
        </div>
      </BottomSheet>
    </div>
  );
}
