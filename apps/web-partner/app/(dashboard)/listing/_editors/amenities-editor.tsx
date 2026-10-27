"use client";

import { Check, Plus, Search, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "../../../_components/ui/button";
import { Drawer } from "../../../_components/ui/drawer";
import { Input } from "../../../_components/ui/input";
import {
  useListing,
  useUpdateListingAmenities,
} from "../../../_hooks/use-listing";
import { useAuthStore } from "../../../_stores/auth-store";
import { cn } from "../../../_lib/utils/cn";
import { useAmenities } from "../../../_hooks/use-catalog";
import {
  isRestaurant,
  isDacha,
  hasBuses,
} from "../../../_lib/utils/partner-labels";

function slugifyAmenity(text: string): string {
  return (
    text
      .toLowerCase()
      .trim()
      .replace(/['’`ʼ]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "custom"
  );
}

const DOMAIN_RECOMMENDED_CODES: Record<string, string[]> = {
  restaurant: [
    "halal",
    "vip_room",
    "live_music",
    "karaoke",
    "outdoor_seating",
    "kids_zone",
    "delivery",
    "takeaway",
    "national_dishes",
    "table_reservation",
    "fast_food",
    "desserts",
    "wifi",
    "parking",
    "ac",
    "terrace",
    "garden",
    "catering",
    "smoking_area",
    "hookah",
    "alcohol",
    "vegan",
    "tv_screens",
    "family_friendly",
  ],
  dacha: [
    "pool",
    "sauna",
    "jacuzzi",
    "garden",
    "terrace",
    "kitchen",
    "wifi",
    "parking",
    "ac",
    "heating",
    "tv",
    "safe",
    "family_friendly",
  ],
  bus: [
    "ac",
    "wifi",
    "tv",
    "wheelchair",
    "safe",
  ],
  hotel: [
    "wifi",
    "wifi_public",
    "breakfast",
    "restaurant",
    "bar",
    "room_service",
    "pool",
    "gym",
    "spa",
    "sauna",
    "jacuzzi",
    "reception_24",
    "concierge",
    "laundry",
    "airport_shuttle",
    "car_rental",
    "parking",
    "ac",
    "safe",
    "family_friendly",
  ],
};

const DOMAIN_CHIP_SUGGESTIONS: Record<string, string[]> = {
  restaurant: [
    "Halol taomlar",
    "VIP xona",
    "Jonli musiqa",
    "Karaoke",
    "Bolalar maydonchasi",
    "Ochiq terrasa",
    "Yetkazib berish",
    "Kalyan",
    "Bepul Wi-Fi",
    "Bepul parking",
    "Milliy tandir",
    "Oila uchun kabina",
  ],
  dacha: [
    "Hovuz",
    "Sauna",
    "Jakuzi",
    "Oshxona",
    "Bog'",
    "Terrasa",
    "Bilyard",
    "Konditsioner",
    "Mangal va barbekyu",
    "PlayStation",
  ],
  bus: [
    "Konditsioner",
    "Wi-Fi",
    "USB zaryadka",
    "Televizor",
    "Keng yukxona",
  ],
  hotel: [
    "Bepul Wi-Fi",
    "Nonushta",
    "Hovuz",
    "Fitness zal",
    "Spa",
    "24/7 resepsiyon",
    "Xonaga xizmat",
    "Kir yuvish",
  ],
};

export function AmenitiesEditor({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data } = useListing();
  const updateAmenities = useUpdateListingAmenities();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const { data: allAmenities = [], isLoading } = useAmenities();

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<"recommended" | "all">("recommended");
  const [customInput, setCustomInput] = useState("");

  const restaurant = isRestaurant(partnerType);
  const dacha = isDacha(partnerType);
  const isBus = hasBuses(partnerType);
  const domainKey = restaurant ? "restaurant" : dacha ? "dacha" : isBus ? "bus" : "hotel";

  const selectedCodes = useMemo(() => new Set(data.amenities || []), [data.amenities]);

  // Normalized catalog items
  const catalogList = useMemo(() => {
    return allAmenities.map((a: any) => {
      const code = String(a.code || "");
      let label = "";
      if (typeof a.name === "string") {
        label = a.name;
      } else if (a.name && typeof a.name === "object") {
        label = a.name.uz || a.name.ru || a.name.en || code;
      } else {
        label = code;
      }
      return { id: code, label };
    });
  }, [allAmenities]);

  const recommendedCodes = useMemo(() => {
    const list = DOMAIN_RECOMMENDED_CODES[domainKey] || DOMAIN_RECOMMENDED_CODES.hotel;
    return new Set(list);
  }, [domainKey]);

  // Display items based on current active tab and search query
  const displayAmenities = useMemo(() => {
    const q = search.trim().toLowerCase();

    // Map existing catalog IDs
    const catalogMap = new Map(catalogList.map((item) => [item.id, item.label]));

    // Include any custom code that user currently has selected even if not in catalog yet
    const allKnownItems: Array<{ id: string; label: string; isCustom?: boolean }> = [
      ...catalogList,
    ];

    for (const code of selectedCodes) {
      if (!catalogMap.has(code)) {
        const fallbackLabel = code
          .replace(/^restaurant_|^dacha_|^hotel_|^transport_|^bus_/i, "")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (c) => c.toUpperCase());
        allKnownItems.push({ id: code, label: fallbackLabel, isCustom: true });
      }
    }

    return allKnownItems.filter((item) => {
      // Search filter
      if (q && !item.label.toLowerCase().includes(q) && !item.id.toLowerCase().includes(q)) {
        return false;
      }

      if (activeTab === "all") {
        return true;
      }

      // "recommended" tab
      if (selectedCodes.has(item.id)) return true;
      if (recommendedCodes.has(item.id)) return true;
      if (restaurant && item.id.startsWith("restaurant_")) return true;
      if (dacha && item.id.startsWith("dacha_")) return true;
      if (isBus && (item.id.startsWith("bus_") || item.id.startsWith("transport_"))) return true;
      if (!item.id.includes("_") && domainKey === "hotel") return true;

      return false;
    });
  }, [catalogList, selectedCodes, search, activeTab, recommendedCodes, restaurant, dacha, isBus, domainKey]);

  const chipSuggestions = DOMAIN_CHIP_SUGGESTIONS[domainKey] || DOMAIN_CHIP_SUGGESTIONS.hotel;

  const handleToggle = (code: string) => {
    const isOn = selectedCodes.has(code);
    const next = isOn
      ? data.amenities.filter((id) => id !== code)
      : [...data.amenities, code];

    updateAmenities.mutate(next, {
      onError: (error) => {
        toast.error(
          error instanceof Error ? error.message : "Qulayliklarni saqlab bo'lmadi",
        );
      },
    });
  };

  const handleAddCustom = (nameToAdd?: string) => {
    const rawName = (nameToAdd ?? customInput).trim();
    if (!rawName) {
      toast.error("Qulaylik nomini kiriting");
      return;
    }

    // Check if an existing catalog item matches
    const existing = catalogList.find(
      (a) => a.label.toLowerCase() === rawName.toLowerCase(),
    );

    const targetCode = existing
      ? existing.id
      : `${domainKey}_${slugifyAmenity(rawName)}`;

    if (selectedCodes.has(targetCode)) {
      toast.info(`"${rawName}" qulayligi allaqachon belgilangan`);
      return;
    }

    const nextAmenities = [...data.amenities, targetCode];
    const customNames = existing ? undefined : { [targetCode]: rawName };

    updateAmenities.mutate(
      {
        amenities: nextAmenities,
        customNames,
      },
      {
        onSuccess: () => {
          toast.success(`"${rawName}" qulayligi muvaffaqiyatli qo'shildi`);
          if (!nameToAdd) setCustomInput("");
        },
        onError: (err) => {
          toast.error(
            err instanceof Error ? err.message : "Qulaylikni qo'shib bo'lmadi",
          );
        },
      },
    );
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={restaurant ? "Restoran qulayliklari" : dacha ? "Dacha qulayliklari" : "Qulayliklar"}
      description={`${selectedCodes.size} ta belgilangan. Admin panel va katalog bilan to'liq sinxronlangan.`}
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between">
          <span className="text-xs text-[var(--muted-foreground)]">
            Tanlangan: <strong>{selectedCodes.size} ta</strong>
          </span>
          <Button onClick={onClose}>Yopish</Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Yangi qulaylik qo'shish inputi */}
        <div className="rounded-xl border border-brand-200 bg-brand-50/40 p-3.5 dark:border-brand-900/60 dark:bg-brand-950/20">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-brand-900 dark:text-brand-300">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span>Yangi qulaylik qo'shish</span>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddCustom();
            }}
            className="flex gap-2"
          >
            <Input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder={
                restaurant
                  ? "Masalan: Jonli tandir kabob, VIP ayvon, Bolalar uchun menyu..."
                  : dacha
                    ? "Masalan: Bilyard stoli, Mangal, Ochiq supa..."
                    : "Masalan: Transfer, Konsyerj..."
              }
              className="bg-white dark:bg-zinc-900"
            />
            <Button
              type="submit"
              disabled={updateAmenities.isPending || !customInput.trim()}
              className="shrink-0 gap-1.5"
            >
              <Plus className="h-4 w-4" />
              Qo'shish
            </Button>
          </form>

          {/* Tezkor tavsiyalar (Chips) */}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {chipSuggestions.map((suggestion) => {
              const alreadyHas = displayAmenities.some(
                (item) =>
                  item.label.toLowerCase() === suggestion.toLowerCase() &&
                  selectedCodes.has(item.id),
              );
              if (alreadyHas) return null;

              return (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() => handleAddCustom(suggestion)}
                  disabled={updateAmenities.isPending}
                  className="inline-flex items-center gap-1 rounded-full border border-brand-300/80 bg-white px-2.5 py-1 text-xs font-medium text-brand-800 transition-colors hover:bg-brand-100 hover:text-brand-900 dark:border-brand-800 dark:bg-zinc-900 dark:text-brand-300 dark:hover:bg-brand-950"
                >
                  <Plus className="h-3 w-3 text-brand-600" />
                  {suggestion}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filtr va Tablar */}
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          {/* Tablar */}
          <div className="flex rounded-lg border border-[var(--border)] bg-[var(--surface-muted)] p-0.5 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("recommended")}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors",
                activeTab === "recommended"
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              Tavsiya etilgan
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "rounded-md px-3 py-1.5 transition-colors",
                activeTab === "all"
                  ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]",
              )}
            >
              Barcha qulayliklar ({catalogList.length})
            </button>
          </div>

          {/* Qidirish */}
          <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Qulayliklarni qidirish..."
              className="h-8 pl-8 pr-7 text-xs"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Qulayliklar ro'yxati */}
        {isLoading ? (
          <div className="flex justify-center p-8 text-sm text-[var(--muted-foreground)]">
            Katalog qulayliklari yuklanmoqda...
          </div>
        ) : displayAmenities.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[var(--border)] p-8 text-center text-sm text-[var(--muted-foreground)]">
            {search
              ? "Qidiruv bo'yicha qulaylik topilmadi."
              : "Hozircha ushbu bo'limda qulayliklar yo'q. Yuqoridagi input orqali yangi qulaylik qo'shishingiz mumkin."}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {displayAmenities.map((item) => {
              const isOn = selectedCodes.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleToggle(item.id)}
                  disabled={updateAmenities.isPending}
                  aria-pressed={isOn}
                  className={cn(
                    "flex items-center justify-start gap-2.5 rounded-lg border p-2.5 text-left text-sm transition-all",
                    isOn
                      ? "border-brand-500 bg-brand-50/70 text-brand-950 font-medium shadow-xs dark:bg-brand-900/30 dark:text-brand-100"
                      : "border-[var(--border)] bg-[var(--surface)] text-zinc-700 hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] dark:text-zinc-300",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                      isOn
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-800",
                    )}
                  >
                    {isOn && <Check className="h-3 w-3 stroke-[3]" aria-hidden />}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.isCustom && (
                    <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-semibold text-brand-800 dark:bg-brand-900/60 dark:text-brand-300">
                      Maxsus
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Drawer>
  );
}
