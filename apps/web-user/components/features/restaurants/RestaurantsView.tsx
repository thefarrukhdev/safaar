"use client";

import { useMemo, useState, useEffect } from "react";
import { Clock, MapPin, PhoneCall, Star, Utensils, SlidersHorizontal, Check, Map } from "lucide-react";
import { formatSum } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import type { CatalogDict } from "@/i18n/dictionaries";
import type { RestaurantItem } from "@/components/catalog/types";
import { UniversalCard } from "@/components/ui/UniversalCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { RestaurantsHero } from "./RestaurantsHero";

export type { RestaurantItem };

// Yordamchi: Hozirgi vaqt restoran ochiqmi?
function isOpenNow(workingHours?: string): boolean | null {
  if (!workingHours) return null;
  // Kutilayotgan format: "09:00 - 23:00"
  const parts = workingHours.split("-").map(p => p.trim());
  if (parts.length !== 2) return null;
  
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  
  const parseMinutes = (timeStr: string) => {
    const [h, m] = timeStr.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return 0;
    return h * 60 + m;
  };
  
  const startMins = parseMinutes(parts[0]);
  let endMins = parseMinutes(parts[1]);
  if (endMins < startMins) endMins += 24 * 60; // Tungi smena
  
  const adjustedCurrent = currentMinutes < startMins && endMins > 24 * 60 
    ? currentMinutes + 24 * 60 
    : currentMinutes;
    
  return adjustedCurrent >= startMins && adjustedCurrent <= endMins;
}

function RestaurantCard({
  item,
  dict,
  locale,
}: {
  item: RestaurantItem;
  dict: CatalogDict["restaurants"];
  locale: Locale;
}) {
  const price = item.averageCheckSum > 0 ? item.averageCheckSum : 0;
  
  const isOpen = isOpenNow(item.workingHours);
  
  const statusBadge = isOpen !== null ? (
    <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium shadow-sm backdrop-blur-md ${isOpen ? 'bg-emerald-500/90 text-white' : 'bg-rose-500/90 text-white'}`}>
      <div className={`h-1.5 w-1.5 rounded-full ${isOpen ? 'bg-white' : 'bg-white/80'}`} />
      {isOpen ? "Hozir ochiq" : "Yopiq"}
    </div>
  ) : null;

  const tags = [
    item.cuisine,
    item.workingHours ? `🕒 ${item.workingHours}` : null,
  ].filter(Boolean) as string[];

  return (
    <UniversalCard
      href={`/${locale}/restaurants/${item.id}`}
      imageSrc={item.imageUrl}
      imageAlt={item.name}
      showFavorite
      topLeft={statusBadge}
      title={item.name}
      location={[item.cityName, item.address].filter(Boolean).join(" · ")}
      tags={tags}
      price={price > 0 ? {
        amount: price,
        period: "o'rtacha chek",
      } : undefined}
      actionLabel="Batafsil"
      extraInfo={
        item.rating > 0 ? (
          <div className="flex items-center gap-1 mt-1">
            <Star className="h-4 w-4 fill-amber-500 text-amber-500" />
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{item.rating.toFixed(1)}</span>
            {item.reviewsCount > 0 && (
              <span className="text-xs text-slate-500">({item.reviewsCount} sharh)</span>
            )}
          </div>
        ) : null
      }
    />
  );
}

export function RestaurantsView({
  dict,
  items,
  locale,
}: {
  dict: CatalogDict["restaurants"];
  items: RestaurantItem[];
  locale: Locale;
}) {
  const [query, setQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("all");
  const [selectedCuisine, setSelectedCuisine] = useState("all");
  // const [showMap, setShowMap] = useState(false); // Map view toggle for later

  const cities = useMemo(
    () => Array.from(new Set(items.map((item) => item.cityName).filter(Boolean))),
    [items],
  );
  
  // Custom curated cuisines to show as pills
  const popularCuisines = ["Milliy", "Yevropa", "Osiyo", "Turkcha", "Fast Food"];
  const dbCuisines = useMemo(
    () => Array.from(new Set(items.map((item) => item.cuisine).filter(Boolean))),
    [items],
  );

  const filtered = useMemo(() => {
    const normalizedQuery = query.toLowerCase();
    return items.filter((item) => {
      const matchesQuery =
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.cuisine.toLowerCase().includes(normalizedQuery) ||
        item.cityName.toLowerCase().includes(normalizedQuery);
      const matchesCity =
        selectedCity === "all" ||
        item.cityName.toLowerCase() === selectedCity.toLowerCase();
      const matchesCuisine =
        selectedCuisine === "all" || item.cuisine.toLowerCase().includes(selectedCuisine.toLowerCase());
      return matchesQuery && matchesCity && matchesCuisine;
    });
  }, [items, query, selectedCity, selectedCuisine]);

  return (
    <div className="mx-auto w-full max-w-[1536px] flex-1 px-4 md:px-8 py-6 sm:px-6">
      <RestaurantsHero
        title={dict.title}
        subtitle={dict.subtitle || "O'zbekistonning eng sara restoran va kafelari"}
        query={query}
        onQueryChange={setQuery}
        placeholder={dict.searchPlaceholder || "Restoran nomini yoki taom turini qidiring..."}
      />
      
      <div className="mt-8 flex flex-col gap-8 lg:flex-row lg:items-start">
        {/* Sidebar Filters */}
        <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-[280px] flex flex-col gap-6 rounded-2xl border border-slate-900/[0.08] bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800">
            <SlidersHorizontal className="h-5 w-5 text-slate-500" />
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">Filtrlar</h3>
          </div>
          
          {/* City Filter */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Shahar</h4>
            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="city" 
                  checked={selectedCity === "all"} 
                  onChange={() => setSelectedCity("all")}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">{dict.allCities || "Barcha shaharlar"}</span>
              </label>
              {cities.map(city => (
                <label key={city} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="city" 
                    checked={selectedCity === city} 
                    onChange={() => setSelectedCity(city)}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">{city}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Cuisine Checkboxes Filter (Simplified as single select for now, but UI looks like multiple) */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">Oshxona turi</h4>
            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="cuisine_filter" 
                  checked={selectedCuisine === "all"} 
                  onChange={() => setSelectedCuisine("all")}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">Barchasi</span>
              </label>
              {dbCuisines.map(cuisine => (
                <label key={cuisine} className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="radio" 
                    name="cuisine_filter" 
                    checked={selectedCuisine === cuisine} 
                    onChange={() => setSelectedCuisine(cuisine)}
                    className="text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-slate-600 dark:text-slate-300">{cuisine}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content (Pills + Grid) */}
        <div className="flex w-full flex-col gap-6">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => setSelectedCuisine("all")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${selectedCuisine === "all" ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                Barchasi
              </button>
              {popularCuisines.map(c => (
                <button 
                  key={c}
                  onClick={() => setSelectedCuisine(c)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${selectedCuisine === c ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                >
                  {c}
                </button>
              ))}
            </div>
            {/* Map toggle stub */}
            <button className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Map className="h-4 w-4" />
              Xaritada ko'rish
            </button>
          </div>

          <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
            <span>Jami: <strong className="text-slate-900 dark:text-white">{filtered.length}</strong> ta restoran topildi</span>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-8">
              <EmptyState
                icon={<Utensils className="h-6 w-6" />}
                title={(dict as any).empty?.title || "Siz izlagan shartlarga mos restoran topilmadi"}
                description="Filtrlarni o'zgartirib qayta urinib ko'ring"
              />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3">
              {filtered.map((item) => (
                <RestaurantCard key={item.id} item={item} dict={dict} locale={locale} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
