"use client";

import {
  Wifi,
  Car,
  Music,
  Mic,
  Baby,
  UtensilsCrossed,
  Sparkles,
  TreePine,
  Wind,
  Flame,
  Tv,
  Bike,
  ShieldCheck,
  Coffee,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";

const AMENITY_ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  parking: Car,
  terrace: TreePine,
  outdoor_seating: TreePine,
  vip_room: Sparkles,
  live_music: Music,
  karaoke: Mic,
  kids_zone: Baby,
  family_friendly: Baby,
  halal: UtensilsCrossed,
  national_dishes: UtensilsCrossed,
  fast_food: Coffee,
  delivery: Bike,
  takeaway: Bike,
  ac: Wind,
  smoking_area: Flame,
  hookah: Flame,
  tv_screens: Tv,
  table_reservation: CheckCircle2,
};

const AMENITY_NAMES_FALLBACK: Record<string, string> = {
  wifi: "Bepul Wi-Fi",
  parking: "Qulay avtoturargoh",
  terrace: "Ochiq havoda terrasa",
  outdoor_seating: "Ochiq havodagi stollar",
  vip_room: "VIP xonalar / Kabinetlar",
  live_music: "Jonli musiqa",
  karaoke: "Karaoke tizimi",
  kids_zone: "Bolalar o'yingohi",
  family_friendly: "Oilaviy qulayliklar",
  halal: "Halol standartlar",
  national_dishes: "Milliy taomlar",
  delivery: "Yetkazib berish xizmati",
  takeaway: "Olib ketish xizmati",
  ac: "Konditsioner",
  smoking_area: "Chekish uchun maxsus hudud",
  hookah: "Kalyan xizmati",
  tv_screens: "Katta ekranlar / Futbol translyatsiyasi",
  table_reservation: "Stol oldindan band qilish",
};

export function RestaurantAmenitiesSection({
  amenities,
  title = "Qulayliklar va xizmatlar",
}: {
  amenities: Array<{ id: string; code: string; name: string }>;
  title?: string;
}) {
  if (!amenities || amenities.length === 0) {
    return null;
  }

  return (
    <section className="flex flex-col gap-4 border-t border-slate-200/80 pt-6">
      <div className="flex items-center gap-2">
        <Sparkles className="h-5 w-5 text-emerald-600" />
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          {title}
        </h2>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {amenities.map((item) => {
          const Icon = AMENITY_ICONS[item.code] || CheckCircle2;
          const displayName =
            item.name && item.name !== item.code
              ? item.name
              : AMENITY_NAMES_FALLBACK[item.code] || item.code.replace(/_/g, " ");

          return (
            <div
              key={item.id || item.code}
              className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 shadow-xs transition hover:border-emerald-300 hover:bg-emerald-50/30"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                <Icon className="h-4 w-4" />
              </div>
              <span className="text-xs font-semibold text-slate-800 line-clamp-2">
                {displayName}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
