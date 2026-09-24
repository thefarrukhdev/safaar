"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import {
  Car, ShieldCheck, Users, Search, Calendar, Minus, Plus, CreditCard, Clock,
} from "lucide-react";
import type { TransportDict } from "@/i18n/dictionaries";
import type { TransportItem } from "@/components/catalog/types";
import { EmptyState } from "@/components/ui/EmptyState";
import { Select } from "@/components/ui/Select";

import { DatePicker } from "@/components/ui/DatePicker";
import { Button } from "@/components/ui/Button";
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
          <span className="rounded-full bg-slate-900/70 backdrop-blur-xs px-2.5 py-0.5 text-[10px] sm:text-xs font-bold text-white shadow-xs">
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
}: {
  dict: TransportDict;
  items: TransportItem[];
  locale: Locale;
  initialCheckIn?: string;
  initialCheckOut?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCity, setSelectedCity] = useState<string>("all");
  const [driverFilter, setDriverFilter] = useState<string>("all");
  const [checkIn, setCheckIn] = useState(initialCheckIn);
  const [checkOut, setCheckOut] = useState(initialCheckOut);
  const [sortBy, setSortBy] = useState<string>("default");

  // Backend (`vehicles`/`bus_companies`) faqat "rent a car" turidagi
  // transportni beradi va hozircha hamma qator uchun categoryKey='transfer'
  // qattiq yozilgan — shuning uchun boshqa kategoriyalar bo'sh natija
  // qaytarishi mumkin. Bu haqiqiy (mock emas) filtr, faqat inventar cheklovi.
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



  const handleClearFilters = () => {
    setSelectedCategory("all");
    setSelectedCity("all");
    setDriverFilter("all");
    setSortBy("default");
    setCheckIn("");
    setCheckOut("");
    router.push(pathname);
  };

  return (
    <main className="mx-auto w-full md:w-[96%] max-w-[1536px] flex-1 px-3 sm:px-4 md:px-8 py-4 sm:py-6 md:py-8">

      {/* ═══ Header Banner ═══ */}
      <div className="relative mb-4 sm:mb-6 flex h-[200px] sm:h-[260px] md:h-[300px] w-full flex-col justify-center overflow-hidden rounded-2xl px-5 sm:px-8 md:px-12">
        <Image
          src="/images/heroes/transport_hero.jpg"
          alt="Transport"
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
          quality={85}
        />
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10 w-full sm:max-w-[70%] lg:max-w-[55%]">
          <h1 className="mb-1.5 sm:mb-2.5 text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight drop-shadow-md">
            {dict.title}
          </h1>
          <p className="hidden sm:block text-[13px] sm:text-[14px] font-medium leading-relaxed text-white/80 drop-shadow">
            {dict.subtitle}
          </p>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="mb-6 sm:mb-10 -mx-3 sm:mx-0 overflow-x-auto pb-2 scrollbar-none">
        <div className="flex gap-2 px-3 sm:px-0 sm:flex-wrap" style={{ minWidth: 'max-content' }}>
          {categories.map((cat) => {
            const isActive = selectedCategory === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-all duration-200 ${
                  isActive
                    ? "bg-primary-600 text-white shadow-sm"
                    : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200 shadow-sm hover:border-primary-300 hover:text-primary-700 dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800"
                }`}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ═══ Inline Filters & Sorting ═══ */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-200/50 dark:bg-slate-900 dark:ring-slate-800">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={selectedCity}
            onChange={setSelectedCity}
            options={[
              { value: "all", label: dict.allCities },
              ...cities.map((city) => ({ value: city, label: city })),
            ]}
            buttonClassName="w-40 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg h-11" className="w-40"
          />
          <div className="w-40">
            <DatePicker
              locale={locale}
              label=""
              value={checkIn}
              onChange={(val) => {
                setCheckIn(val);
                const p = new URLSearchParams();
                if (val) p.set("checkIn", val);
                if (checkOut) p.set("checkOut", checkOut);
                router.push(`/${locale}/transport?${p.toString()}`);
              }}
              min={new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div className="w-40">
            <DatePicker
              locale={locale}
              label=""
              value={checkOut}
              onChange={(val) => {
                setCheckOut(val);
                const p = new URLSearchParams();
                if (checkIn) p.set("checkIn", checkIn);
                if (val) p.set("checkOut", val);
                router.push(`/${locale}/transport?${p.toString()}`);
              }}
              min={checkIn || new Date().toISOString().slice(0, 10)}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={driverFilter}
            onChange={setDriverFilter}
            options={[
              { value: "all", label: dict.allDrivers },
              { value: "with", label: dict.driverIncluded },
              { value: "without", label: dict.withoutDriver },
            ]}
            buttonClassName="w-40 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg h-11" className="w-40"
          />
          <Select
            value={sortBy}
            onChange={setSortBy}
            options={[
              { value: "default", label: dict.sortDefault },
              { value: "price_asc", label: dict.sortPriceAsc },
              { value: "price_desc", label: dict.sortPriceDesc },
              { value: "seats", label: dict.sortSeats },
            ]}
            buttonClassName="w-48 bg-slate-50 dark:bg-slate-800 border-transparent rounded-lg h-11" className="w-48"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Car className="h-6 w-6" />}
          title={dict.noVehiclesAvailable ?? dict.noData}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <TransportCard key={item.id} item={item} dict={dict} locale={locale} />
          ))}
        </div>
      )}

      </main>
  );
}
