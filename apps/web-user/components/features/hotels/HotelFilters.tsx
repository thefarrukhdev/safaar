"use client";

import { useState, useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { HotelsDict } from "@/i18n/dictionaries";
import { Filter, ChevronDown, Star } from "lucide-react";
import { FilterSidebar } from "@/components/ui/FilterSidebar";
import { FilterGroup } from "@/components/ui/FilterGroup";
import { Button } from "@/components/ui/Button";

export function HotelFilters({
  dict,
  sortSelect,
}: {
  dict: Pick<HotelsDict, "filters" | "types" | "starOptions" | "amenityOptions" | "paymentOptions">;
  sortSelect?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(searchParams.get("search") ?? "");
  const [stars, setStars] = useState(searchParams.get("stars") ?? "5");
  const [priceRange, setPriceRange] = useState<number>(
    Number(searchParams.get("max_price")) || 2000000
  );
  const [selectedType, setSelectedType] = useState<string>(
    pathname.includes("dachas")
      ? "dachas"
      : pathname.includes("sanatoriums")
      ? "sanatoriums"
      : pathname.includes("resorts")
      ? "resorts"
      : "hotels"
  );
  const [amenities, setAmenities] = useState<string[]>(searchParams.getAll("amenities"));
  const [paymentType, setPaymentType] = useState<string | undefined>(searchParams.get("payment_type") ?? undefined);


  const push = useCallback(
    (params: URLSearchParams) => {
      params.delete("page");
      const query = params.toString();
      router.push(`${pathname}${query ? `?${query}` : ""}`);
    },
    [router, pathname]
  );

  const apply = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (searchQuery) params.set("search", searchQuery); else params.delete("search");
    if (stars) params.set("stars", stars); else params.delete("stars");
    if (priceRange < 2000000) params.set("max_price", String(priceRange)); else params.delete("max_price");
    
    params.delete("amenities");
    amenities.forEach(a => params.append("amenities", a));
    
    if (paymentType) params.set("payment_type", paymentType); else params.delete("payment_type");
    
    push(params);
    setOpen(false);
  }, [searchParams, searchQuery, stars, priceRange, push, amenities, paymentType]);

  const reset = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    for (const key of ["search", "stars", "min_price", "max_price"]) {
      params.delete(key);
    }
    setSearchQuery("");
    setStars("5");
    setPriceRange(2000000);
    push(params);
    setOpen(false);
  }, [searchParams, push]);

  const activeCount = [
    searchParams.get("search"),
    searchParams.get("stars"),
    searchParams.get("min_price"),
    searchParams.get("max_price"),
  ].filter(Boolean).length;

  return (
    <div className="w-full">
      {/* Mobile Actions Toolbar */}
      <div className="grid grid-cols-2 gap-2 mb-3 lg:hidden">
        <Button
          type="button"
          variant="secondary"
          size="md"
          
          onClick={() => setOpen(true)}
          className="w-full flex items-center justify-between !h-11 min-h-[44px] px-3.5 text-xs sm:text-sm font-bold"
        >
          <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
            <Filter className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
            <span className="truncate">{dict.filters.toggle}</span>
            {activeCount > 0 && (
              <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-blue-600 px-1 text-[11px] font-black text-white">
                {activeCount}
              </span>
            )}
          </span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-500" />
        </Button>

        {sortSelect ? <div className="w-full min-w-0">{sortSelect}</div> : null}
      </div>

      <FilterSidebar
        title={dict.filters.title}
        isOpen={open}
        onClose={() => setOpen(false)}
        onApply={apply}
        onReset={reset}
        applyLabel={dict.filters.apply}
        resetLabel={dict.filters.reset}
      >
        {/* NARX (1 KECHA) */}
        <FilterGroup title={dict.filters.pricePerNight}>
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
              <span>0 {dict.filters.currency}</span>
              <span className="text-blue-600 dark:text-blue-400 font-extrabold">
                {priceRange.toLocaleString("fr-FR").replace(/\s/g, " ")} {dict.filters.currency}
              </span>
            </div>
            <input
              type="range"
              min={100000}
              max={2000000}
              step={50000}
              value={priceRange}
              onChange={(e) => setPriceRange(Number(e.target.value))}
              className="h-2 w-full accent-blue-600 bg-slate-200 rounded-lg cursor-pointer dark:bg-slate-700"
            />
          </div>
        </FilterGroup>

        {/* YULDUZLAR */}
        <FilterGroup title={dict.filters.stars}>
          <div className="flex flex-col gap-2 pt-1">
            {[
              { val: "5", label: dict.starOptions.five, starsCount: 5, count: 2 },
              { val: "4", label: dict.starOptions.fourPlus, starsCount: 4, count: 3 },
              { val: "3", label: dict.starOptions.threePlus, starsCount: 3, count: 5 },
            ].map((item) => (
              <label
                key={item.val}
                className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer group hover:text-blue-600"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={stars === item.val}
                    onChange={() => setStars(stars === item.val ? "" : item.val)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span className="flex items-center gap-1">
                    <span className="flex text-amber-400">
                      {"★".repeat(item.starsCount)}
                    </span>
                    <span className="ml-1 text-slate-600 dark:text-slate-400 font-medium">
                      {item.label}
                    </span>
                  </span>
                </span>
                <span className="text-slate-400 text-[11px] font-semibold">
                  ({item.count})
                </span>
              </label>
            ))}
          </div>
        </FilterGroup>

        {/* MAHSULOT TURI */}
        <FilterGroup title={dict.filters.propertyType}>
          <div className="flex flex-col gap-2 pt-1">
            {[
              { id: "hotels", name: dict.types.hotels, count: 4 },
              { id: "sanatoriums", name: dict.types.sanatoriums, count: 1 },
              { id: "resorts", name: dict.types.resorts, count: 0 },
            ].map((cat) => (
              <label
                key={cat.id}
                className="flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-600"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedType === cat.id}
                    onChange={() => setSelectedType(cat.id)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <span>{cat.name}</span>
                </span>
                <span className="text-slate-400 text-[11px] font-semibold">
                  ({cat.count})
                </span>
              </label>
            ))}
          </div>
        </FilterGroup>

        {/* QULAYLIKLAR (AMENITIES) */}
        <FilterGroup title={dict.filters.amenities}>
          <div className="flex flex-col gap-2 pt-1">
            {[
              { id: "wifi", name: dict.amenityOptions.wifi },
              { id: "pool", name: dict.amenityOptions.pool },
              { id: "sauna", name: dict.amenityOptions.sauna },
              { id: "breakfast", name: dict.amenityOptions.breakfast },
              { id: "parking", name: dict.amenityOptions.parking },
              { id: "gym", name: dict.amenityOptions.gym },
            ].map((amenity) => (
              <label
                key={amenity.id}
                className="flex items-center text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-600"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="amenities"
                    value={amenity.id}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setAmenities(prev => [...prev, amenity.id]);
                      } else {
                        setAmenities(prev => prev.filter(a => a !== amenity.id));
                      }
                    }}
                    checked={amenities.includes(amenity.id)}
                  />
                  <span>{amenity.name}</span>
                </span>
              </label>
            ))}
          </div>
        </FilterGroup>

        {/* TO'LOV TURI (PAYMENT TYPE) */}
        <FilterGroup title={dict.filters.paymentType}>
          <div className="flex flex-col gap-2 pt-1">
            {[
              { id: "online_payment", name: dict.paymentOptions.online },
              { id: "pay_at_property", name: dict.paymentOptions.atProperty },
            ].map((ptype) => (
              <label
                key={ptype.id}
                className="flex items-center text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer hover:text-blue-600"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    name="payment_type"
                    value={ptype.id}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    onChange={(e) => {
                      if (e.target.checked) {
                        setPaymentType(ptype.id);
                      } else {
                        setPaymentType(undefined);
                      }
                    }}
                    checked={paymentType === ptype.id}
                  />
                  <span>{ptype.name}</span>
                </span>
              </label>
            ))}
          </div>
        </FilterGroup>
      </FilterSidebar>
    </div>
  );
}

