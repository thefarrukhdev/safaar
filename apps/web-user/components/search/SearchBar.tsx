"use client";

import { useState, type FormEvent } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, Calendar, Users, MapPin } from "lucide-react";
import { CityPicker } from "./CityPicker";
import { SearchDatePicker } from "./SearchDatePicker";
import { Clock, X } from "lucide-react";
import { useEffect, useRef } from "react";
import { GuestPicker } from "./GuestPicker";
import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "@/lib/search-params";
import type { PropertyType, SearchDefaults } from "./types";
import type { Locale } from "@/i18n/config";
import type { CommonDict } from "@/i18n/dictionaries";
import type { CityOption } from "@/types/view";
import { trackSearchPerformed } from "@/lib/services/analytics/tracker";
import { Button } from "@/components/ui/Button";

export type { PropertyType, SearchDefaults };

const fieldWrapperClass = "group relative flex min-w-0 flex-1 items-center gap-3 rounded-full bg-transparent px-4 py-3 transition-colors duration-200 hover:bg-slate-900/[0.03] md:px-5 cursor-pointer";

export function SearchBar({
  locale,
  dict,
  cities,
  defaults,
}: {
  locale: Locale;
  dict: CommonDict["search"];
  cities: CityOption[];
  defaults?: SearchDefaults;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [cityId, setCityId] = useState(defaults?.cityId ?? "");
  const [recentSearches, setRecentSearches] = useState<any[]>([]);
  const [showRecent, setShowRecent] = useState(false);
  const destRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("safaar_recent_searches");
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch (e) {}
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (destRef.current && !destRef.current.contains(e.target as Node)) {
        setShowRecent(false);
      }
    }
    if (showRecent) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [showRecent]);

  // Sync CheckIn/CheckOut from URL params since SearchDatePicker uses nuqs
  const [dates, setDates] = useQueryStates({
    checkIn: searchParamsParsers.checkIn,
    checkOut: searchParamsParsers.checkOut,
  }, { shallow: false });
  const checkIn = dates.checkIn || "";
  const checkOut = dates.checkOut || "";

  const [guests, setGuests] = useState(defaults?.guests ?? 2);

  const typeFromPath = pathname.split("/").pop() as PropertyType;
  const typePathsReverse: Record<string, PropertyType> = {
    hotels: "hotel",
    dachas: "dacha",
    sanatoriums: "sanatorium",
    resorts: "resort",
  };
  const activeType =
    typePathsReverse[typeFromPath] ||
    (searchParams.get("type") as PropertyType) ||
    "hotel";

  const today = new Date().toISOString().split("T")[0];

  const typePaths: Record<PropertyType, string> = {
    hotel: `/${locale}/hotels`,
    dacha: `/${locale}/dachas`,
    sanatorium: `/${locale}/sanatoriums`,
    resort: `/${locale}/resorts`,
  };

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (cityId) params.set("city_id", cityId);
        if (guests) params.set("guests", String(guests));


    const selectedCity = cities.find((c) => c.id === cityId)?.name || cityId;
    
    if (cityId) {
      const newSearch = {
        cityId,
        cityName: selectedCity,
        checkIn,
        checkOut,
        guests,
        timestamp: Date.now(),
      };
      setRecentSearches(prev => {
        const filtered = prev.filter(s => s.cityId !== cityId);
        const updated = [newSearch, ...filtered].slice(0, 5);
        localStorage.setItem("safaar_recent_searches", JSON.stringify(updated));
        return updated;
      });
    }

    trackSearchPerformed({
      city: selectedCity,
      checkIn,
      checkOut,
      guests,
    });

    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);


    const base = typePaths[activeType] ?? `/${locale}/hotels`;
    const query = params.toString();
    router.push(`${base}${query ? `?${query}` : ""}`);
  }

  return (
    <div className="mx-auto w-full relative z-50">
      <form
        onSubmit={handleSubmit}
        className="relative flex flex-col rounded-xl border border-slate-900/[0.12] bg-white p-2 shadow-emboss-alpha transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] focus-within:border-blue-600 focus-within:ring-1 focus-within:ring-blue-600 md:flex-row md:items-center md:rounded-full sm:p-2"
      >
        {/* 1. Shahar / Destinatsiya */}
        <div 
          className={fieldWrapperClass}
          ref={destRef}
          onClickCapture={() => {
            if (!cityId && recentSearches.length > 0 && !showRecent) {
               setShowRecent(true);
            }
          }}
        >
          <MapPin className="h-5 w-5 shrink-0 text-primary-600 group-hover:text-primary-700 transition-colors" aria-hidden />
          <div className="min-w-0 flex-1">
            <CityPicker
              cities={cities}
              value={cityId}
              onChange={(id) => {
                setCityId(id);
                setShowRecent(false); // inputga yozilsa/tanlansa yopilsin
              }}
              placeholder={dict.cityPlaceholder}
            />
          </div>
          
          {showRecent && recentSearches.length > 0 && !cityId && (
            <div className="absolute top-full left-0 z-50 mt-2 w-full rounded-xl border border-slate-900/[0.08] bg-white shadow-float p-3">
              {recentSearches.map((search) => (
                <div
                  key={search.timestamp}
                  className="group flex cursor-pointer items-center justify-between rounded-xl px-3 py-2.5 bg-transparent border border-transparent hover:bg-slate-900/[0.03] transition-colors"
                  onClick={() => {
                    setCityId(search.cityId);
                    setGuests(search.guests);
                    const params = new URLSearchParams(window.location.search);
                    if (search.checkIn) params.set("checkIn", search.checkIn);
                    else params.delete("checkIn");
                    if (search.checkOut) params.set("checkOut", search.checkOut);
                    else params.delete("checkOut");
                    window.history.pushState(null, "", `?${params.toString()}`);
                    
                    setShowRecent(false);
                  }}
                >
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-slate-400 shrink-0" />
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm text-slate-800">{search.cityName}</span>
                      {(search.checkIn || search.checkOut) && (
                        <span className="text-xs text-slate-500">
                          {search.checkIn} {search.checkOut ? ` - ${search.checkOut}` : ''} • {search.guests} {dict.guestsSuffix ?? "mehmon"}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="p-1 rounded-full text-slate-400 bg-transparent hover:bg-slate-900/[0.05] hover:text-slate-600 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRecentSearches(prev => {
                        const updated = prev.filter(s => s.timestamp !== search.timestamp);
                        localStorage.setItem("safaar_recent_searches", JSON.stringify(updated));
                        if (updated.length === 0) setShowRecent(false);
                        return updated;
                      });
                    }}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <span className="hidden h-6 w-px bg-slate-900/[0.12] md:block" aria-hidden="true"></span>

        {/* 2. Sanalar (Kirish - Chiqish) */}
        <div className="min-w-0 flex-1 px-2 md:px-0">
          <SearchDatePicker locale={locale} dict={dict} />
        </div>

        <span className="hidden h-6 w-px bg-slate-900/[0.12] md:block" aria-hidden="true"></span>

        {/* 3. Mehmonlar soni */}
        <div className={fieldWrapperClass}>
          <div className="flex w-full items-center gap-3">
            <Users className="h-5 w-5 shrink-0 text-primary-600 group-hover:text-primary-700 transition-colors" aria-hidden />
            <div className="flex-1">
              <GuestPicker value={guests} onChange={setGuests} />
            </div>
          </div>
        </div>

        {/* 4. Qidirish tugmasi */}
        <div className="shrink-0 md:pl-2">
          <Button
            type="submit"
            className="w-full md:w-auto h-12 md:h-12 px-8 uppercase tracking-wide rounded-full shadow-emboss-primary bg-blue-600 text-white font-medium transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-blue-700 active:scale-[0.97] active:shadow-emboss-pressed"
          >
            <Search className="h-5 w-5 stroke-[2.5]" aria-hidden />
            <span>{dict.submit}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
