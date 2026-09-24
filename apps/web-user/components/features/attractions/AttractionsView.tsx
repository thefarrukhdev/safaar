"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import { Map, X, SlidersHorizontal, Search, Compass, Sparkles, LayoutGrid, MapPin } from "lucide-react";
import { gsap } from "gsap";
import { AttractionCard } from "@/components/attractions/AttractionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import type { AttractionItem } from "@/components/catalog/types";
import type { AttractionsDict } from "@/i18n/dictionaries";

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

// ─── FILTER HEADER (Responsive: Horizontal scroll on mobile) ─────────────────
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
  onQueryChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  categories: { id: string; label: string }[];
  onOpenFilters: () => void;
  totalCount: number;
  dict: AttractionsDict;
}) {
  return (
    <div className="sticky top-0 z-30 flex flex-col gap-3 bg-slate-50/80 px-4 py-3 backdrop-blur-xl dark:bg-[#080E0D]/80 sm:gap-4 sm:px-5 sm:py-4">
      {/* Search and Filters */}
      <div className="flex w-full items-center gap-2">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={dict.searchPlaceholder || "Obida nomi yoki shahar bo'yicha qidiruv..."}
            className="h-12 w-full rounded-full border-slate-200 bg-white pl-11 pr-4 text-sm font-medium shadow-xs transition-shadow hover:shadow-sm focus-visible:ring-primary-500 dark:border-slate-800 dark:bg-slate-900"
          />
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        </div>
        <button
          type="button"
          onClick={onOpenFilters}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-xs hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 md:hidden"
          aria-label="Filtrlar"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop categories */}
      <div className="hidden md:flex items-center gap-2 overflow-x-auto scrollbar-none">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-all ${
              selectedCategory === cat.id
                ? "bg-primary-600 text-white shadow-sm"
                : "bg-white text-slate-600 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      
      {/* Results count */}
      <div className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-wider text-slate-500">
        <Sparkles className="h-3.5 w-3.5 text-amber-500" />
        {totalCount} {dict.title}
      </div>
    </div>
  );
}

// ─── PLACEHOLDER MAP (Matches layout aesthetics) ─────────────────────────────
function MapPlaceholder({ dict }: { dict: AttractionsDict }) {
  return (
    <div className="relative h-full w-full bg-[#E5E5DF] dark:bg-[#1A1A1A]">
      {/* Decorative Grid */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
      
      {/* Floating UI Elements */}
      <div className="absolute right-6 top-6 flex flex-col gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-lg dark:bg-slate-800 dark:text-slate-300">
          <Compass className="h-5 w-5" />
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700 shadow-lg dark:bg-slate-800 dark:text-slate-300">
          <LayoutGrid className="h-5 w-5" />
        </div>
      </div>
      
      {/* Center Message */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center gap-4 rounded-3xl bg-white/80 p-6 backdrop-blur-xl shadow-2xl dark:bg-slate-950/80">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
          <MapPin className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-black text-slate-900 dark:text-white">{dict.map?.title}</h3>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">{dict.map?.soon}</p>
        </div>
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
const AttractionsMap = dynamic(() => import("./AttractionsMap"), {
  ssr: false,
  loading: () => <MapPlaceholder dict={{} as any} />
});

export function AttractionsView({
  dict,
  items,
}: {
  dict: AttractionsDict;
  items: AttractionItem[];
}) {
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
          {/* ═══ Header Banner ═══ */}
          <div className="relative mb-4 sm:mb-6 flex h-[200px] sm:h-[260px] md:h-[300px] w-full flex-col justify-center overflow-hidden rounded-2xl px-5 sm:px-8 md:px-12">
            <Image
              src="/images/heroes/samarqans.jpg"
              alt="Attractions hero"
              fill
              priority
              className="object-cover object-center"
              sizes="(max-width: 768px) 100vw, 50vw"
              quality={85}
            />
            <div className="absolute inset-0 bg-black/45" />

            <div className="relative z-10 w-full sm:max-w-[90%] lg:max-w-[80%]">
              <h1 className="mb-1.5 sm:mb-2.5 text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md">
                {dict.title}
              </h1>
              <p className="hidden sm:block text-[13px] sm:text-[14px] font-medium leading-relaxed text-white/80 drop-shadow">
                {dict.subtitle || "O'zbekistonning eng go'zal joylari"}
              </p>
            </div>
          </div>

          {filtered.length === 0 ? (
            <EmptyState
              icon={<Compass className="h-6 w-6" />}
              title={dict.empty?.title || "Ma'lumot topilmadi"}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {filtered.map((item, index) => (
                <AttractionCard
                  key={item.id}
                  item={item}
                  categoryLabel={dict.categories?.[item.categoryKey] ?? item.categoryDefault}
                  index={index}
                  onHover={(hovering) => setHoveredId(hovering ? item.id : null)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── RIGHT: Sticky Map Panel (Desktop) ──────────────────── */}
      <div className="hidden w-1/2 overflow-hidden border-l border-slate-200/70 dark:border-slate-800 md:flex md:flex-col">
        <div className="sticky top-0 h-full">
          <AttractionsMap attractions={filtered} hoveredId={hoveredId} />
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
        {dict.map?.show || "Xaritada ko'rish"}
      </button>

      {/* ── MOBILE BOTTOM SHEET: Filters ──────────────────────── */}
      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={dict.filters?.title || "Filtrlar"}>
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
      <BottomSheet open={mapOpen} onClose={() => setMapOpen(false)} title={dict.map?.title || "Xarita"}>
        <div className="flex h-[42vh] flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-slate-200 bg-[#F8FAF9]">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary-50">
            <Map className="h-7 w-7 text-primary-600" />
          </div>
          <p className="text-sm font-bold text-slate-600">{dict.map?.soon || "Xarita tez orada ulanadi"}</p>
        </div>
      </BottomSheet>
    </div>
  );
}
