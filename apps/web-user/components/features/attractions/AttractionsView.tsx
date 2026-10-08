"use client";

import { useMemo, useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Map, X, SlidersHorizontal, Search, Compass, Sparkles, LayoutGrid, MapPin } from "lucide-react";
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
    <div className="sticky top-0 z-30 flex flex-col gap-3 md:gap-4 bg-white px-4 py-2.5 md:py-4 border-b border-slate-200 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl sm:text-2xl font-semibold tracking-tight text-slate-900">
          {dict.title}
        </h1>
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-slate-500">
          <Sparkles className="h-3.5 w-3.5 text-slate-400" />
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
            className="h-11 w-full rounded-full border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium text-slate-900 placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white transition-colors duration-200 ease-out hover:border-slate-300"
          />
          <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
        </div>
        <button
          type="button"
          onClick={onOpenFilters}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 active:scale-[0.97] transition-all duration-200 ease-out md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
          aria-label="Filtrlar"
        >
          <SlidersHorizontal className="h-5 w-5" />
        </button>
      </div>

      {/* Desktop categories */}
      <div className="hidden md:flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onCategoryChange(cat.id)}
            className={`shrink-0 inline-flex h-9 items-center rounded-full px-4 text-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.97] ${ selectedCategory === cat.id ? "border border-blue-600 bg-white text-blue-600" : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 hover:border-slate-300" }`}
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
    <div className="relative h-full w-full bg-slate-100">
      <div className="absolute right-6 top-6 flex flex-col gap-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900">
          <Compass className="h-5 w-5" />
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900">
          <LayoutGrid className="h-5 w-5" />
        </div>
      </div>
      
      <div className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center gap-4 rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex h-16 w-16 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500">
          <MapPin className="h-8 w-8" />
        </div>
        <div className="text-center">
          <h3 className="text-lg font-semibold text-slate-900">{dict.map?.title}</h3>
          <p className="text-sm text-slate-500">{dict.map?.soon}</p>
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
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <div className={`fixed inset-0 z-40 lg:hidden ${open ? "pointer-events-auto" : "pointer-events-none"}`}>
      <div
        className={`absolute inset-0 bg-slate-900/40 transition-opacity duration-300 ease-out ${open ? "opacity-100" : "opacity-0"}`}
        aria-hidden
        onClick={onClose}
      />
      <div
        className={`absolute inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-slate-200 bg-white transition-transform duration-300 ease-out ${open ? "translate-y-0" : "translate-y-full"}`}
      >
        <div className="flex justify-center pb-1 pt-3">
          <div className="h-1 w-10 rounded-full bg-slate-200" />
        </div>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 pb-3 pt-1">
          <span className="text-sm font-semibold text-slate-900">{title}</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-500 hover:bg-slate-50 active:scale-[0.97] transition-all duration-200 ease-out"
            aria-label="Yopish"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[85vh] overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
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
  locale,
}: {
  dict: AttractionsDict;
  items: AttractionItem[];
  locale: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const query = searchParams.get("q") || "";
  const selectedCategory = searchParams.get("category") || "all";

  const setQuery = (q: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (q) {
      params.set("q", q);
    } else {
      params.delete("q");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const setSelectedCategory = (c: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (c && c !== "all") {
      params.set("category", c);
    } else {
      params.delete("category");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

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
    <div className="mx-auto flex min-h-[calc(100svh-56px)] w-full md:w-[96%] max-w-[1536px] bg-white md:min-h-[calc(100svh-72px-3rem)] lg:h-[calc(100svh-72px-3rem)] md:overflow-hidden md:my-6 md:rounded-2xl md:border md:border-slate-200 md:shadow-sm">
      
      {/* ── LEFT: Scrollable List Panel ────────────────────────── */}
      <div className="flex w-full flex-col lg:w-[55%] xl:w-[60%] lg:overflow-hidden">
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
        <div className="flex-1 px-4 py-4 md:py-6 sm:px-6 lg:px-8 lg:overflow-y-auto">
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
                  locale={locale}
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
          <AttractionsMap attractions={filtered} hoveredId={hoveredId} locale={locale} />
        </div>
      </div>

      {/* ── MOBILE FAB: Show Map ───────────────────────────────── */}
      <button
        type="button"
        onClick={() => setMapOpen(true)}
        className="fixed bottom-6 left-1/2 z-30 inline-flex -translate-x-1/2 items-center justify-center gap-2 rounded-full bg-blue-600 px-6 h-11 text-sm font-medium text-white transition-all duration-200 ease-out hover:bg-blue-700 active:scale-[0.97] lg:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
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
              className={`inline-flex h-9 items-center rounded-full px-4 text-sm transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white active:scale-[0.97] ${ selectedCategory === cat.id ? "border border-blue-600 bg-white text-blue-600" : "border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 hover:border-slate-300" }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </BottomSheet>

      {/* ── MOBILE BOTTOM SHEET: Map ──────────────────────────── */}
      <BottomSheet open={mapOpen} onClose={() => setMapOpen(false)} title={dict.map?.title || "Xarita"}>
        <div className="h-[70vh] w-full overflow-hidden rounded-2xl border border-slate-200">
          <AttractionsMap attractions={filtered} hoveredId={hoveredId} locale={locale} />
        </div>
      </BottomSheet>
    </div>
  );
}
