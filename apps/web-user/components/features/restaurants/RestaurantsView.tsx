"use client";

import { useMemo, useState } from "react";
import { Clock, MapPin, PhoneCall, Star, Utensils, Search, SlidersHorizontal, Map } from "lucide-react";
import { formatSum } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import type { CatalogDict } from "@/i18n/dictionaries";
import { CatalogHeader } from "@/components/catalog/CatalogHeader";
import type { RestaurantItem } from "@/components/catalog/types";
import { UniversalCard } from "@/components/ui/UniversalCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/Input";

export type { RestaurantItem };

function RestaurantCard({
  item,
  dict,
  locale,
}: {
  item: RestaurantItem;
  dict: CatalogDict["restaurants"];
  locale: Locale;
}) {
  const price = item.averageCheckSum > 0 ? item.averageCheckSum : 180000;
  const tags = [
    item.cuisine,
    item.workingHours ? `🕒 ${item.workingHours}` : "🕒 09:00 - 23:00",
  ].filter(Boolean) as string[];

  return (
    <UniversalCard
      href={`/${locale}/restaurants/${item.id}`}
      locale={locale}
      imageSrc={item.imageUrl}
      imageAlt={item.name}
      showFavorite
      title={item.name}
      location={[item.cityName, item.address].filter(Boolean).join(" · ")}
      tags={tags}
      price={{
        amount: price,
        period: (dict as any).averageCheck || "o'rtacha chek",
      }}
      actionLabel={(dict as any).viewDetails || "Batafsil"}
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

  const cities = useMemo(
    () => Array.from(new Set(items.map((item) => item.cityName).filter(Boolean))),
    [items],
  );
  
  
  const cuisineKeys: Record<string, string> = {
    "Milliy": "National",
    "Yevropa": "European",
    "Osiyo": "Asian",
    "Turkcha": "Turkish",
    "Fast Food": "Fast Food",
  };

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
    <div className="mx-auto w-full max-w-[1536px] flex-1 px-4 md:px-8 py-8 sm:px-6">
      <CatalogHeader
        title={dict.title}
        subtitle={dict.subtitle || "O'zbekistonning eng sara restoran va kafelari"}
        searchControls={
          <>
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.searchPlaceholder || "Restoran nomini yoki taom turini qidiring..."}
              className="pl-10"
            />
          </>
        }
      />
      
      <div className="mt-6 flex flex-col gap-6 lg:flex-row lg:items-start">
        {/* Sidebar Filters */}
        <aside className="w-full shrink-0 lg:sticky lg:top-24 lg:w-[260px] flex flex-col gap-6 rounded-xl border border-slate-900/[0.08] bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800">
            <SlidersHorizontal className="h-4 w-4 text-slate-500" />
            <h3 className="text-base font-bold text-slate-900 dark:text-white">{(dict as any).filtersTitle || "Filtrlar"}</h3>
          </div>
          
          {/* City Filter */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{(dict as any).city || "Shahar"}</h4>
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

          {/* Cuisine Filter */}
          <div className="flex flex-col gap-3">
            <h4 className="text-sm font-semibold text-slate-900 dark:text-white">{(dict as any).cuisineType || "Oshxona turi"}</h4>
            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
              <label className="flex items-center gap-2 cursor-pointer">
                <input 
                  type="radio" 
                  name="cuisine_filter" 
                  checked={selectedCuisine === "all"} 
                  onChange={() => setSelectedCuisine("all")}
                  className="text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-slate-600 dark:text-slate-300">{(dict as any).all || "Barchasi"}</span>
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
                  <span className="text-sm text-slate-600 dark:text-slate-300">{(dict as any).cuisines?.[cuisineKeys[cuisine] || cuisine] || cuisine}</span>
                </label>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Content (Pills + Grid) */}
        <div className="flex w-full flex-col gap-5">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => setSelectedCuisine("all")}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${selectedCuisine === "all" ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
              >
                {(dict as any).all || "Barchasi"}
              </button>
              {popularCuisines.map(c => (
                <button 
                  key={c}
                  onClick={() => setSelectedCuisine(c)}
                  className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${selectedCuisine === c ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'}`}
                >
                  {(dict as any).cuisines?.[cuisineKeys[c] || c] || c}
                </button>
              ))}
            </div>
            
            <button className="hidden sm:flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
              <Map className="h-4 w-4" />
              {(dict as any).viewOnMap || "Xaritada ko'rish"}
            </button>
          </div>

          <div className="mb-2 flex items-center justify-between text-sm text-slate-500">
            <span>{((dict as any).resultsCount || "Jami: {count} ta restoran topildi").replace("{count}", filtered.length.toString())}</span>
          </div>

          {filtered.length === 0 ? (
            <div className="mt-4">
              <EmptyState
                icon={<Utensils className="h-6 w-6" />}
                title={(dict as any).empty?.title || "Siz izlagan shartlarga mos restoran topilmadi"}
                description={(dict as any).emptyHint || "Filtrlarni o'zgartirib qayta urinib ko'ring"}
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
