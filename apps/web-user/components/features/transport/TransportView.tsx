"use client";

import { useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { useQueryState, parseAsString } from "nuqs";
import {
  Car, Search,
} from "lucide-react";
import type { TransportDict } from "@/i18n/dictionaries";
import type { TransportItem } from "@/components/catalog/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";
import { DatePicker } from "@/components/ui/DatePicker";
import { UniversalCard } from "@/components/ui/UniversalCard";
import type { Locale } from "@/i18n/config";

export type { TransportItem };

function TransportCard({
  item,
  dict,
  locale,
}: {
  item: TransportItem;
  dict: TransportDict;
  locale: Locale;
}) {
  const price = item.pricePerDaySum > 0 ? item.pricePerDaySum : 650000;
  const categoryLabel = dict.categories?.[item.categoryKey] ?? item.categoryDefault;

  const tags = [
    `${item.seats} ${dict.seats || "o'rin"}`,
    item.hasDriver ? (dict.driverIncluded || "Haydovchi bilan") : (dict.withoutDriver || "Haydovchisiz"),
  ].filter(Boolean);

  return (
    <UniversalCard
      href={`/${locale}/transport/${item.id}`}
      locale={locale}
      imageSrc={item.imageUrl}
      imageAlt={item.name}
      topLeft={
        categoryLabel ? (
          <span className="rounded-full bg-slate-900/70 px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-white">
            {categoryLabel}
          </span>
        ) : undefined
      }
      showFavorite
      title={item.name}
      location={item.cityName}
      tags={tags}
      price={{
        amount: price,
        period: dict.perDay || "kuniga",
      }}
      actionLabel={dict.book}
    />
  );
}

export function TransportView({
  dict,
  items,
  locale,
  initialCheckIn = "",
  initialCheckOut = "",
  heroBg,
}: {
  dict: TransportDict;
  items: TransportItem[];
  locale: Locale;
  initialCheckIn?: string;
  initialCheckOut?: string;
  heroBg?: {
    imageUrl?: string;
    title?: string;
    subtitle?: string;
  };
}) {
  // Using nuqs for URL-driven state
  const [selectedCategory, setSelectedCategory] = useQueryState("category", parseAsString.withDefault("all"));
  const [selectedCity, setSelectedCity] = useQueryState("city", parseAsString.withDefault("all"));
  const [driverFilter, setDriverFilter] = useQueryState("driver", parseAsString.withDefault("all"));
  const [checkIn, setCheckIn] = useQueryState("checkIn", parseAsString.withDefault(initialCheckIn));
  const [checkOut, setCheckOut] = useQueryState("checkOut", parseAsString.withDefault(initialCheckOut));
  const [sortBy, setSortBy] = useQueryState("sortBy", parseAsString.withDefault("default"));

  const categories = useMemo(
    () => [
      { id: "all", label: dict.categories?.all ?? dict.allTypes },
      { id: "rent", label: dict.categories?.rent },
      { id: "transfer", label: dict.categories?.transfer },
      { id: "vip", label: dict.categories?.vip },
    ],
    [dict],
  );

  const cities = useMemo(
    () => Array.from(new Set(items.map((item) => item.cityName).filter(Boolean))),
    [items],
  );

  const filtered = useMemo(() => {
    const result = items.filter((item) => {
      const matchesCategory = selectedCategory === "all" || item.categoryKey === selectedCategory;
      const matchesCity =
        selectedCity === "all" || item.cityName.toLowerCase() === selectedCity.toLowerCase();
      const matchesDriver =
        driverFilter === "all" ||
        (driverFilter === "with" ? item.hasDriver : !item.hasDriver);
      return matchesCategory && matchesCity && matchesDriver;
    });

    const sorted = [...result];
    if (sortBy === "price_asc") sorted.sort((a, b) => a.pricePerDaySum - b.pricePerDaySum);
    else if (sortBy === "price_desc") sorted.sort((a, b) => b.pricePerDaySum - a.pricePerDaySum);
    else if (sortBy === "seats") sorted.sort((a, b) => b.seats - a.seats);
    return sorted;
  }, [items, selectedCategory, selectedCity, driverFilter, sortBy]);

  return (
    <main className="mx-auto w-full md:w-[96%] max-w-[1536px] flex-1 px-3 sm:px-4 md:px-8 py-4 sm:py-6 md:py-8">
      {/* Header Banner */}
      <div className="relative mb-6 sm:mb-8 flex h-[200px] sm:h-[260px] md:h-[300px] w-full flex-col justify-center overflow-hidden rounded-2xl md:rounded-[32px] border border-slate-200 px-5 sm:px-8 md:px-12">
        <Image
          src={heroBg?.imageUrl || "/images/heroes/transport_hero.jpg"}
          alt="Transport"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
          quality={85}
        />
        <div className="absolute inset-0 bg-black/40" />

        <div className="relative z-10 w-full sm:max-w-[70%] lg:max-w-[55%]">
          <h1 className="mb-2 text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
            {heroBg?.title || dict.title}
          </h1>
          <p className="text-sm sm:text-base font-medium leading-relaxed text-white/90 max-w-lg">
            {heroBg?.subtitle || dict.subtitle}
          </p>
        </div>
      </div>

      {/* Unified Search Bar (Premium UI) */}
      <div className="relative z-20 -mt-10 sm:-mt-14 mb-8 mx-auto w-full max-w-5xl">
        <div className="flex flex-col md:flex-row items-stretch md:items-center bg-white rounded-3xl md:rounded-full border border-slate-200 p-2 md:p-3 gap-2 md:gap-0">
          
          {/* City */}
          <div className="flex-1 px-4 py-2 hover:bg-white :bg-slate-800/50 rounded-2xl md:rounded-full transition-colors">
            <Select
              value={selectedCity}
              onChange={setSelectedCity}
              options={[
                { value: "all", label: dict.allCities },
                ...cities.map((city) => ({ value: city, label: city })),
              ]}
              label={dict.search.from}
              buttonClassName="border-transparent bg-transparent  p-0 h-auto hover:bg-transparent focus-visible:ring-0 text-sm md:text-base px-0"
              menuClassName="w-56 mt-4"
            />
          </div>

          <div className="hidden md:block w-px h-12 bg-slate-200" />

          {/* Dates */}
          <div className="flex-[1.5] flex items-center px-4 py-2 hover:bg-white :bg-slate-800/50 rounded-2xl md:rounded-full transition-colors gap-2">
            <div className="flex-1">
              <DatePicker
                locale={locale}
                label={dict.checkIn}
                placeholder={dict.search.selectDate}
                value={checkIn}
                onChange={(val) => {
                  setCheckIn(val);
                  if (!checkOut && val) setCheckOut(val);
                }}
                min={new Date().toISOString().slice(0, 10)}
                className="w-full"
                compact
              />
            </div>
            <div className="w-px h-8 bg-slate-200" />
            <div className="flex-1">
              <DatePicker
                locale={locale}
                label={dict.checkOut}
                placeholder={dict.search.selectDate}
                value={checkOut}
                onChange={setCheckOut}
                min={checkIn || new Date().toISOString().slice(0, 10)}
                className="w-full"
                compact
              />
            </div>
          </div>

          <div className="hidden md:block w-px h-12 bg-slate-200" />

          {/* Driver */}
          <div className="flex-1 px-4 py-2 hover:bg-white :bg-slate-800/50 rounded-2xl md:rounded-full transition-colors">
            <Select
              value={driverFilter}
              onChange={setDriverFilter}
              options={[
                { value: "all", label: dict.allDrivers },
                { value: "with", label: dict.driverIncluded },
                { value: "without", label: dict.withoutDriver },
              ]}
              label={dict.driver}
              buttonClassName="border-transparent bg-transparent  p-0 h-auto hover:bg-transparent focus-visible:ring-0 text-sm md:text-base px-0"
              menuClassName="w-56 mt-4"
            />
          </div>

          {/* Search Button Indicator (Visual only as state is instant) */}
          <div className="mt-2 md:mt-0 p-2 md:pl-2 md:pr-0">
            <div className="w-full md:w-14 h-12 md:h-14 bg-primary-600 text-white rounded-2xl md:rounded-full flex items-center justify-center">
              <Search className="w-5 h-5 md:w-6 md:h-6" />
              <span className="md:hidden ml-2 font-bold text-sm">{dict.search.searchButton}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        {/* Category Tabs */}
        <div className="overflow-x-auto pb-2 scrollbar-none -mx-3 px-3 md:mx-0 md:px-0">
          <div className="flex gap-2 min-w-max">
            {categories.map((cat) => {
              const isActive = selectedCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  onClick={() => setSelectedCategory(cat.id)}
                  className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-200 ${ isActive ? "bg-slate-900 text-white " : "bg-white text-slate-600 hover:bg-white border border-slate-200 hover:border-slate-300 :border-slate-700" }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sort */}
        <div className="w-48 shrink-0">
          <Select
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: "default", label: dict.sortDefault },
              { value: "price_asc", label: dict.sortPriceAsc },
              { value: "price_desc", label: dict.sortPriceDesc },
              { value: "seats", label: dict.sortSeats },
            ]}
            buttonClassName="w-full bg-white  border-slate-200  rounded-xl h-11"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Car className="h-6 w-6" />}
          title={dict.noVehiclesAvailable ?? dict.noData}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((item) => (
            <TransportCard key={item.id} item={item} dict={dict} locale={locale} />
          ))}
        </div>
      )}
    </main>
  );
}
