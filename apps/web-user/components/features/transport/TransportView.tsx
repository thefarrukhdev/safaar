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
import { Input } from "@/components/ui/Input";
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
  const [query, setQuery] = useState("");
  const [passengers, setPassengers] = useState<number>(1);
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
    const normalizedQuery = query.toLowerCase();
    const result = items.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.name.toLowerCase().includes(normalizedQuery) ||
        item.cityName.toLowerCase().includes(normalizedQuery);
      const matchesCategory = selectedCategory === "all" || item.categoryKey === selectedCategory;
      const matchesCity =
        selectedCity === "all" || item.cityName.toLowerCase() === selectedCity.toLowerCase();
      const matchesDriver =
        driverFilter === "all" ||
        (driverFilter === "with" ? item.hasDriver : !item.hasDriver);
      const matchesSeats = item.seats <= 0 || item.seats >= passengers;
      return matchesQuery && matchesCategory && matchesCity && matchesDriver && matchesSeats;
    });

    const sorted = [...result];
    if (sortBy === "price_asc") sorted.sort((a, b) => a.pricePerDaySum - b.pricePerDaySum);
    else if (sortBy === "price_desc") sorted.sort((a, b) => b.pricePerDaySum - a.pricePerDaySum);
    else if (sortBy === "seats") sorted.sort((a, b) => b.seats - a.seats);
    return sorted;
  }, [items, query, selectedCategory, selectedCity, driverFilter, passengers, sortBy]);

  // Sana oralig'i mavjudlikni backend'da haqiqatan tekshiradi (`GET
  // /catalog/transports?check_in=&check_out=`, mavjud bookinglar bilan
  // to'qnashuvchi mashinalarni chiqarib tashlaydi) — shuning uchun bu
  // qidiruv server komponentga navigatsiya orqali qayta so'rov yuboradi,
  // xuddi shu mexanizm `initialCheckIn`/`initialCheckOut` orqali allaqachon
  // qabul qilingan edi, faqat UI'dan hech qachon chaqirilmagan edi.
  const handleSearch = () => {
    const params = new URLSearchParams();
    if (checkIn) params.set("checkIn", checkIn);
    if (checkOut) params.set("checkOut", checkOut);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  };

  const handleClearFilters = () => {
    setSelectedCategory("all");
    setSelectedCity("all");
    setDriverFilter("all");
    setQuery("");
    setPassengers(1);
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

      {/* ═══ Search Panel ═══ */}
      <div className="relative z-20 mb-6 sm:mb-10 rounded-xl bg-white p-3 sm:p-4 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_8px_32px_rgba(0,0,0,0.06),0_2px_4px_rgba(0,0,0,0.04)] dark:bg-slate-900 dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] ring-1 ring-slate-200/50">
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:grid-cols-3 md:gap-4">

          <div className="relative sm:col-span-2 md:col-span-1">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={dict.searchPlaceholder}
              className="h-[60px] sm:h-[68px] pl-10 rounded-[16px]"
            />
          </div>

          <Select
            value={selectedCity}
            onChange={setSelectedCity}
            options={[
              { value: "all", label: dict.allCities },
              ...cities.map((city) => ({ value: city, label: city })),
            ]}
            buttonClassName="h-[60px] sm:h-[68px] rounded-[16px]"
          />

          <div className="flex h-[60px] sm:h-[68px] flex-col justify-center rounded-[16px] bg-slate-50 px-5 border border-transparent dark:bg-slate-800">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500">
              <Users className="h-3.5 w-3.5 text-primary-500" />
              <span>{(dict as any).search?.passengers || "Yo'lovchilar soni"}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between text-[15px] font-bold text-slate-900 dark:text-white">
              <span>{passengers} {(dict as any).search?.passengerUnit || "kishi"}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPassengers(Math.max(1, passengers - 1))} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm border border-slate-200 transition-colors hover:border-primary-300 hover:text-primary-600">
                  <Minus className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => setPassengers(passengers + 1)} className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-600 shadow-sm border border-slate-200 transition-colors hover:border-primary-300 hover:text-primary-600">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>

          <DatePicker
            locale={locale}
            label={dict.checkIn}
            value={checkIn}
            onChange={setCheckIn}
            min={new Date().toISOString().slice(0, 10)}
          />

          <DatePicker
            locale={locale}
            label={dict.checkOut}
            value={checkOut}
            onChange={setCheckOut}
            min={checkIn || new Date().toISOString().slice(0, 10)}
          />

          <div className="pt-1 sm:pt-0 sm:col-span-2 md:col-span-1">
            <Button
              variant="primary"
              size="lg"
              
              onClick={handleSearch}
              className="w-full h-[60px] sm:h-[68px] uppercase tracking-wider font-extrabold"
            >
              <Search className="mr-2 h-5 w-5 stroke-[2.5]" />
              {dict.checkAvailability}
            </Button>
          </div>
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

      {/* ═══ Results Toolbar & Sorting ═══ */}
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5 min-w-0">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
            {dict.resultsCount.replace("{count}", String(filtered.length))}
          </h2>
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
            buttonClassName="w-40 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl" className="w-40"
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
            buttonClassName="w-48 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 rounded-xl" className="w-48"
          />
          <button
            onClick={handleClearFilters}
            className="text-xs font-bold text-primary-600 hover:underline dark:text-primary-400"
          >
            {dict.clearFilters}
          </button>
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

      {/* Features Footer — Silk Road Accents */}
      <div className="mt-16 grid grid-cols-1 gap-5 rounded-xl bg-white p-8 shadow-[inset_0_1px_0_rgba(255,255,255,1),0_4px_12px_rgba(0,0,0,0.04)] border border-slate-200/80 dark:border-slate-800 dark:bg-slate-900/50 sm:grid-cols-2 lg:grid-cols-4">

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600 dark:bg-primary-900/30">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="pt-1">
            <h4 className="text-[15px] font-bold text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>{(dict as any).search?.safeTravelTitle || "Xavfsiz sayohat"}</h4>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
              {(dict as any).search?.safeTravelDesc || "Tekshirilgan haydovchilar va sug'urtalangan transport"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-600/10 text-primary-600 dark:bg-primary-600/20">
            <Clock className="h-6 w-6" />
          </div>
          <div className="pt-1">
            <h4 className="text-[15px] font-bold text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>{(dict as any).search?.support24Title || "24/7 yordam"}</h4>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
              {(dict as any).search?.support24Desc || "Istalgan vaqtda yordam berish xizmatimiz"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-900/30">
            <CreditCard className="h-6 w-6" />
          </div>
          <div className="pt-1">
            <h4 className="text-[15px] font-bold text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>{(dict as any).search?.onlinePaymentTitle || "Onlayn to'lov"}</h4>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
              {(dict as any).search?.onlinePaymentDesc || "Xavfsiz va qulay to'lov tizimi (Uzcard, Humo)"}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30">
            <Calendar className="h-6 w-6" />
          </div>
          <div className="pt-1">
            <h4 className="text-[15px] font-bold text-slate-900 dark:text-white" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>{(dict as any).search?.flexibleTitle || "Moslashuvchan"}</h4>
            <p className="mt-1 text-xs font-medium leading-relaxed text-slate-500">
              {(dict as any).search?.flexibleDesc || "Ko'pchilik buyurtmalarda bepul bekor qilish imkoni"}
            </p>
          </div>
        </div>

      </div>
    </main>
  );
}
