"use client";

import { useState, useMemo } from "react";
import { LayoutGrid, Map } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { HotelsDict } from "@/i18n/dictionaries";
import { formatSum } from "@/lib/money";
import { AccommodationCard } from "@/components/accommodation/AccommodationCard";
import { HotelsPagination } from "@/components/hotels/HotelsPagination";
import { InteractiveMapView, type MapMarkerItem } from "@/components/features/map/InteractiveMapView";
import { EmptyState } from "@/components/ui/EmptyState";
import { api } from "@/lib/api";
import type { HotelListItem } from "@/types/view";

export interface AccommodationListWithMapProps {
  items: HotelListItem[];
  locale: Locale;
  dict: HotelsDict;
  basePath: string;
  safePage: number;
  totalPages: number;
  currentParams: Record<string, string>;
  headerTitle?: React.ReactNode;
  headerSort?: React.ReactNode;
  filters?: React.ReactNode;
  activeFilters?: React.ReactNode;
}

export function AccommodationListWithMap({
  items,
  locale,
  dict,
  basePath,
  safePage,
  totalPages,
  currentParams,
  headerTitle,
  headerSort,
  filters,
  activeFilters,
}: AccommodationListWithMapProps) {
  const [viewMode, setViewMode] = useState<"grid" | "map">("grid");
  const [hoveredHotelId, setHoveredHotelId] = useState<string | null>(null);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(null);

  const [mapModeItems, setMapModeItems] = useState<HotelListItem[] | null>(null);
  const activeItems = viewMode === "map" && mapModeItems ? mapModeItems : items;

  const mapItems: MapMarkerItem[] = useMemo(
    () =>
      activeItems.map((h) => ({
        id: h.id,
        name: h.name,
        cityName: h.cityName,
        priceFormatted: formatSum(h.minPriceSum),
        rating: h.rating,
        stars: h.stars,
        imageUrl: h.imageUrl,
        linkUrl: `/${locale}/hotels/${h.slug}`,
        lat: h.latitude,
        lng: h.longitude,
      })),
    [activeItems, locale]
  );

  const handleBoundsChange = async (bounds: { neLat: number; neLng: number; swLat: number; swLng: number }) => {
    try {
      const response = await api.hotels.getHotels(locale, {
        neLat: bounds.neLat,
        neLng: bounds.neLng,
        swLat: bounds.swLat,
        swLng: bounds.swLng,
        limit: 50,
      });
      setMapModeItems(response.items);
    } catch (err) {
      console.error("Failed to fetch hotels for new map bounds", err);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      {/* View Toggle Bar & Header */}
      {headerTitle || headerSort ? (
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-900/[0.08] pb-4">
            <div>{headerTitle}</div>
            <div className="flex items-center gap-3">
              {headerSort}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  aria-pressed={viewMode === "grid"}
                  onClick={() => setViewMode("grid")}
                  className="inline-flex h-10 max-md:h-11 items-center justify-center gap-2 rounded-full border border-slate-900/[0.06] bg-slate-900/[0.05] px-5 text-sm font-medium text-slate-900  transition-[background-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-900/[0.08] active:scale-[0.97] active:bg-slate-900/[0.12]  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 aria-pressed:bg-slate-900 aria-pressed:text-white aria-pressed:hover:bg-slate-900/90 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <LayoutGrid className="size-5" />
                  <span className="hidden sm:inline">Grid</span>
                </button>

                <button
                  type="button"
                  aria-pressed={viewMode === "map"}
                  onClick={() => setViewMode("map")}
                  className="inline-flex h-10 max-md:h-11 items-center justify-center gap-2 rounded-full border border-slate-900/[0.06] bg-slate-900/[0.05] px-5 text-sm font-medium text-slate-900  transition-[background-color,color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-900/[0.08] active:scale-[0.97] active:bg-slate-900/[0.12]  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 aria-pressed:bg-slate-900 aria-pressed:text-white aria-pressed:hover:bg-slate-900/90 motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <Map className="size-5" />
                  <span className="hidden sm:inline">{(dict as any).mapView || "Xarita"}</span>
                </button>
              </div>
            </div>
          </div>
          {activeFilters}
        </div>
      ) : null}

      {/* Main Content Layout with Sidebar */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <aside>
          {filters}
        </aside>
        <section>
      {items.length === 0 ? (
        <EmptyState
          title="Ob'ektlar topilmadi"
          description="Afsuski, kiritilgan filtr va parametrlar bo'yicha hech qanday ob'ekt topilmadi. Qidiruv parametrlarini o'zgartirib ko'ring."
          actionLabel="Filtrlarni tozalash"
          actionHref={`${basePath}`}
        />
      ) : viewMode === "map" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_460px]">
          {/* List Column */}
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {activeItems.map((hotel) => (
                <div
                  key={hotel.id}
                  onMouseEnter={() => setHoveredHotelId(hotel.id)}
                  onMouseLeave={() => setHoveredHotelId(null)}
                  className={`transition-all duration-200 rounded-xl ${
                    selectedHotelId === hotel.id ? "ring-2 ring-blue-600 ring-offset-4" : ""
                  }`}
                >
                  <AccommodationCard
                    hotel={hotel}
                    locale={locale}
                    labels={{ perNight: dict.perNight, reviews: dict.reviews }}
                  />
                </div>
              ))}
            </div>

            <HotelsPagination
              basePath={basePath}
              params={currentParams}
              page={safePage}
              totalPages={totalPages}
              dict={dict.pagination}
            />
          </div>

          {/* Sticky Interactive Map Column */}
          <div className="lg:sticky lg:top-24 lg:h-[calc(100vh-120px)]">
            <InteractiveMapView
              items={mapItems}
              hoveredItemId={hoveredHotelId}
              selectedItemId={selectedHotelId}
              onSelectItem={(item) => setSelectedHotelId(item.id)}
              onBoundsChange={handleBoundsChange}
              className="h-[450px] w-full lg:h-full rounded-xl overflow-hidden border border-slate-900/[0.08]"
            />
          </div>
        </div>
      ) : (
        /* Standard Grid View */
        <>
          <div className="grid gap-3 sm:gap-6 grid-cols-2 lg:grid-cols-3">
            {items.map((hotel) => (
              <AccommodationCard
                key={hotel.id}
                hotel={hotel}
                locale={locale}
                labels={{ perNight: dict.perNight, reviews: dict.reviews }}
              />
            ))}
          </div>
          <HotelsPagination
            basePath={basePath}
            params={currentParams}
            page={safePage}
            totalPages={totalPages}
            dict={dict.pagination}
          />
        </>
      )}
        </section>
      </div>
    </div>
  );
}
