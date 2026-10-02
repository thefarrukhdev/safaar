"use client";

import { useMemo } from "react";
import { Clock, MapPin, PhoneCall, Star, Utensils, Search, SlidersHorizontal, Map } from "lucide-react";
import { formatSum } from "@/lib/money";
import type { Locale } from "@/i18n/config";
import type { CatalogDict } from "@/i18n/dictionaries";
import Image from "next/image";
import type { RestaurantItem } from "@/components/catalog/types";
import { UniversalCard } from "@/components/ui/UniversalCard";
import { Select } from "@/components/ui/Select";
import { useQueryState, parseAsString } from "nuqs";

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
 heroBg,
}: {
 dict: CatalogDict["restaurants"];
 items: RestaurantItem[];
 locale: Locale;
 heroBg?: {
 imageUrl?: string;
 title?: string;
 subtitle?: string;
 };
}) {
 const [query, setQuery] = useQueryState("q", parseAsString.withDefault(""));
 const [selectedCity, setSelectedCity] = useQueryState("city", parseAsString.withDefault("all"));
 const [selectedCuisine, setSelectedCuisine] = useQueryState("cuisine", parseAsString.withDefault("all"));
 const [selectedCategory, setSelectedCategory] = useQueryState("category", parseAsString.withDefault("all"));

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
 return items.filter((item) => {
 const q = query.toLowerCase();
 const matchesQuery =
 !q ||
 item.name.toLowerCase().includes(q) ||
 (item.cuisine && item.cuisine.toLowerCase().includes(q));

 const matchesCity = selectedCity === "all" || item.cityName === selectedCity;
 const matchesCuisine = selectedCuisine === "all" || item.cuisine === selectedCuisine;
 
 // Ignoring selectedCategory for now as it wasn't strictly filtered in previous version,
 // but we maintain it in URL state.
 
 return matchesQuery && matchesCity && matchesCuisine;
 });
 }, [items, query, selectedCity, selectedCuisine]);

 // Options for selects
 const cityOptions = [
 { value: "all", label: dict.allCities || "Barcha shaharlar" },
 ...cities.map(c => ({ value: c, label: c }))
 ];

 const cuisineOptions = [
 { value: "all", label: (dict as any).all || "Barchasi" },
 ...dbCuisines.map(c => ({ value: c, label: (dict as any).cuisines?.[cuisineKeys[c] || c] || c }))
 ];

 return (
 <div className="mx-auto w-full max-w-[1536px] flex-1 px-4 md:px-8 py-8 sm:px-6">
 {/* ═══ Header Banner ═══ */}
 <div className="relative mb-6 sm:mb-8 flex h-[200px] sm:h-[260px] md:h-[300px] w-full flex-col justify-center overflow-hidden rounded-2xl border border-slate-200 px-5 sm:px-8 md:px-12">
 <Image
 src={heroBg?.imageUrl || "/images/heroes/hero.png"}
 alt="Restaurants hero"
 fill
 priority
 className="object-cover object-center"
 sizes="100vw"
 quality={85}
 />
 <div className="absolute inset-0 bg-black/45" />

 <div className="relative z-10 w-full sm:max-w-[70%] lg:max-w-[55%]">
 <h1 className="mb-1.5 sm:mb-2.5 text-lg sm:text-2xl md:text-3xl font-extrabold tracking-tight text-white leading-tight">
 {heroBg?.title || dict.title}
 </h1>
 <p className="hidden sm:block text-[13px] sm:text-[14px] font-medium leading-relaxed text-white/80">
 {heroBg?.subtitle || dict.subtitle || "O'zbekistonning eng sara restoran va kafelari"}
 </p>
 </div>
 </div>
 
 {/* ═══ Premium Sticky Filter Bar ═══ */}
 <div className="sticky top-20 z-30 mb-8 rounded-2xl border border-slate-200 bg-white/80 p-3 sm:p-4">
 <div className="flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6">
 {/* Search Input */}
 <div className="relative flex-1 group">
 <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-400 group-focus-within:text-blue-500 transition-colors">
 <Search className="h-5 w-5" />
 </div>
 <input
 type="text"
 value={query}
 onChange={(e) => setQuery(e.target.value)}
 placeholder={dict.searchPlaceholder || "Restoran nomini yoki taom turini qidiring..."}
 className="h-12 w-full rounded-xl bg-white border border-slate-200 pl-11 pr-4 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white :bg-slate-950 focus:ring-4 focus:ring-blue-500/10 placeholder:text-slate-400"
 />
 </div>
 
 <div className="hidden lg:block h-8 w-px bg-slate-200" />
 
 <div className="flex flex-col sm:flex-row items-center gap-4 lg:gap-6 shrink-0">
 {/* City Select */}
 <div className="w-full sm:w-48">
 <Select
 value={selectedCity}
 onChange={setSelectedCity}
 options={cityOptions}
 placeholder={(dict as any).city || "Shahar"}
 className="w-full"
 buttonClassName="h-12 bg-white border-slate-200 hover:bg-white :bg-slate-800 transition-colors"
 icon={<MapPin className="h-4 w-4 text-slate-500 mr-2" />}
 />
 </div>
 
 {/* Cuisine Select (Mobile mostly, Desktop can use tabs or both) */}
 <div className="w-full sm:w-48 lg:hidden">
 <Select
 value={selectedCuisine}
 onChange={setSelectedCuisine}
 options={cuisineOptions}
 placeholder={(dict as any).cuisineType || "Oshxona turi"}
 className="w-full"
 buttonClassName="h-12 bg-white border-slate-200 hover:bg-white :bg-slate-800 transition-colors"
 icon={<Utensils className="h-4 w-4 text-slate-500 mr-2" />}
 />
 </div>

 {/* Map Button */}
 <button className="h-12 w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 text-sm font-medium text-slate-700 transition-all hover:bg-white hover:text-slate-900 focus:ring-4 focus:ring-slate-100 :bg-slate-800 :text-white :ring-slate-800">
 <Map className="h-4 w-4" />
 {(dict as any).viewOnMap || "Xaritada ko'rish"}
 </button>
 </div>
 </div>
 
 {/* Category/Cuisine Tabs (Desktop) */}
 <div className="mt-4 hidden lg:flex items-center gap-2 overflow-x-auto pb-1 custom-scrollbar">
 <button 
 onClick={() => setSelectedCuisine("all")}
 className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all ${ selectedCuisine === "all" ? 'bg-slate-900 text-white ' : 'bg-white border border-slate-200 text-slate-600 hover:bg-white :bg-slate-800' }`}
 >
 {(dict as any).all || "Barchasi"}
 </button>
 {popularCuisines.map(c => (
 <button 
 key={c}
 onClick={() => setSelectedCuisine(c)}
 className={`flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium transition-all whitespace-nowrap ${ selectedCuisine === c ? 'bg-slate-900 text-white ' : 'bg-white border border-slate-200 text-slate-600 hover:bg-white :bg-slate-800' }`}
 >
 {(dict as any).cuisines?.[cuisineKeys[c] || c] || c}
 </button>
 ))}
 
 <div className="ml-auto">
 <Select
 value={selectedCuisine}
 onChange={setSelectedCuisine}
 options={cuisineOptions.filter(o => o.value === 'all' || !popularCuisines.includes(o.value))}
 placeholder={(dict as any).moreCuisines || "Boshqa"}
 className="w-32"
 buttonClassName="h-10 bg-transparent border-0 text-slate-500 hover:text-slate-900 :text-white"
 menuClassName="right-0 left-auto w-48"
 />
 </div>
 </div>
 </div>

 <div className="flex w-full flex-col gap-6">
 <div className="flex items-center justify-between text-sm font-medium text-slate-500">
 <span>{((dict as any).resultsCount || "Jami: {count} ta restoran topildi").replace("{count}", filtered.length.toString())}</span>
 </div>

 {filtered.length === 0 ? (
 <div className="mt-4 flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-20 px-4 text-center">
 <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white">
 <Utensils className="h-8 w-8 text-slate-400" />
 </div>
 <h3 className="mb-2 text-lg font-bold text-slate-900">
 {(dict as any).empty?.title || "Siz izlagan shartlarga mos restoran topilmadi"}
 </h3>
 <p className="text-slate-500 max-w-md">
 {(dict as any).emptyHint || "Filtrlarni o'zgartirib qayta urinib ko'ring yoki boshqa nom bilan izlang."}
 </p>
 <button
 onClick={() => {
 setQuery("");
 setSelectedCity("all");
 setSelectedCuisine("all");
 setSelectedCategory("all");
 }}
 className="mt-6 rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-600 focus:outline-none focus:ring-4 focus:ring-blue-500/20"
 >
 Filtrlarni tozalash
 </button>
 </div>
 ) : (
 <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
 {filtered.map((item) => (
 <RestaurantCard key={item.id} item={item} dict={dict} locale={locale} />
 ))}
 </div>
 )}
 </div>
 </div>
 );
}
