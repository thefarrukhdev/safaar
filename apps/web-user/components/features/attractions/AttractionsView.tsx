"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Map, X, SlidersHorizontal, Search, Compass, Sparkles, LayoutGrid, MapPin } from "lucide-react";
import { gsap } from "gsap";
import { AttractionCard } from "@/components/attractions/AttractionCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";
import type { AttractionItem } from "@/components/catalog/types";
import type { AttractionsDict } from "@/i18n/dictionaries";


// ─── FILTER HEADER ───────────────────────────────────────────────────────────
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
    <div className="sticky top-0 z-30 flex flex-col gap-4 bg-white/90 px-4 py-4 pb-2 border-b border-slate-100 [#080E0D]/90 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900">
          {dict.title}
        </h1>
        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          {totalCount} {dict.map?.title || "joy"}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="flex w-full items-center gap-3">
        <div className="relative flex-1">
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={dict.searchPlaceholder || "Obida nomi yoki shahar bo'yicha qidiruv..."}
            className="h-12 w-full rounded-full border-slate-200 bg-white/50 pl-11 pr-4 text-sm font-medium focus-visible:ring-primary-500"
          />
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        </div>
        <button
          type="button"
          onClick={onOpenFilters}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 hover:bg-white md:hidden"
          aria-label="Filtrlar"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop categories */}
      <div className="hidden md:flex items-center gap-2 overflow-x-auto scrollbar-none pb-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.id)}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-all ${ selectedCategory === cat.id ? "bg-slate-900 text-white " : "border border-slate-200 bg-white text-slate-600 hover:bg-white :bg-slate-800" }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── PLACEHOLDER MAP ─────────────────────────────────────────────────────────
function MapPlaceholder({ dict }: { dict: AttractionsDict }) {
  return (
    <div className="relative h-full w-full bg-[#E5E5DF] [#1A1A1A]">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
      
      <div className="absolute right-6 top-6 flex flex-col gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700">
          <Compass className="h-5 w-5" />
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-700">
          <LayoutGrid className="h-5 w-5" />
        </div>
      </div>
      
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-4 rounded-3xl border border-slate-200 bg-white/80 p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-100 text-primary-600">
          <MapPin className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-black text-slate-900">{dict.map?.title}</h3>
          <p className="text-sm font-medium text-slate-500">{dict.map?.soon}</p>
        </div>
      </div>
    </div>
  );
}

// ─── MOBILE BOTTOM SHEET ─────────────────────────────────────────────────────
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
        className="fixed inset-0 z-40 bg-black/45 lg:hidden"
        aria-hidden
        onClick={handleClose}
      />
      <div
        ref={sheetRef}
        className="fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-slate-200 bg-white lg:hidden"
        style={{ transform: "translateY(100%)" }}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-center justify-between border-b border-slate-100 px-5 pb-3 pt-1">
          <span className="text-sm font-black text-slate-900">{title}</span>
          <button
            type="button"
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 hover:bg-slate-200"
            aria-label="Yopish"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[85vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </>
  );
}

// ─── MAIN VIEW ───────────────────────────────────────────────────────────────
const AttractionsMap = dynamic(() => import("./AttractionsMap"), {
  ssr: false,
  loading: () => <MapPlaceholder dict={{} as AttractionsDict} />
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
    <div className="mx-auto flex h-[calc(100svh-56px)] w-full max-w-[1920px] bg-white [#080E0D] md:h-[calc(100svh-72px)]">
      
      {/* ── LEFT: Scrollable List Panel ────────────────────────── */}
      <div className="flex w-full flex-col overflow-hidden lg:w-[55%] xl:w-[60%]">
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
        <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6 lg:px-8">
          {filtered.length === 0 ? (
            <EmptyState
              icon={<Compass className="h-6 w-6" />}
              title={dict.empty?.title || "Ma'lumot topilmadi"}
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 2xl:grid-cols-3">
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
      <div className="hidden lg:flex lg:w-[45%] xl:w-[40%] flex-col overflow-hidden border-l border-slate-200">
        <div className="sticky top-0 h-full">
          <AttractionsMap attractions={filtered} hoveredId={hoveredId} />
        </div>
      </div>

      {/* ── MOBILE FAB: Show Map ───────────────────────────────── */}
      <button
        type="button"
        onClick={() => setMapOpen(true)}
        className="fixed bottom-6 left-1/2 z-30 inline-flex -translate-x-1/2 items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white transition-transform hover:scale-105 active:scale-95 lg:hidden"
      >
        <Map className="h-4 w-4" />
        {dict.map?.show || "Xarita"}
      </button>

      {/* ── MOBILE BOTTOM SHEET: Filters ──────────────────────── */}
      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title={dict.filters?.title || "Filtrlar"}>
        <div className="flex flex-wrap gap-2">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => { setSelectedCategory(cat.id); setFiltersOpen(false); }}
              className={`rounded-full px-4 py-2.5 text-sm font-bold transition-all ${ selectedCategory === cat.id ? "bg-slate-900 text-white " : "border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900 " }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* ── MOBILE BOTTOM SHEET: Map ──────────────────────────── */}
      <BottomSheet open={mapOpen} onClose={() => setMapOpen(false)} title={dict.map?.title || "Xarita"}>
        <div className="h-[70vh] w-full overflow-hidden rounded-xl">
          <AttractionsMap attractions={filtered} hoveredId={hoveredId} />
        </div>
      </BottomSheet>
    </div>
  );
}
