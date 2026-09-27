"use client";
import { bookingTranslations } from "./i18n";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RestaurantDetailView } from "@safaar/api-client";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import { Button } from "@/components/ui/Button";
import type { CatalogDict } from "@/i18n/dictionaries";

export function RestaurantBookingSection({
  dict,
  restaurant,
  isLoggedIn = false,
}: {
  restaurant: RestaurantDetailView;
  dict: CatalogDict["restaurants"];
  isLoggedIn?: boolean;
}) {
  const params = useParams<{ lang?: string }>();
  const locale = params?.lang || "uz";
  const router = useRouter();
  
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [slotTime, setSlotTime] = useState<string>("19:00");
  const [guests, setGuests] = useState<number>(2);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const t = bookingTranslations[locale as keyof typeof bookingTranslations] || bookingTranslations.uz;

  const maxCapacity = restaurant.tables.length > 0 
    ? Math.max(...restaurant.tables.map(t => t.capacity)) 
    : 0;

  const handleBookClick = () => {
    setErrorMsg(null);
    setIsLoading(true);

    // Barcha mos stollarni topib, ularni sig'imi bo'yicha o'sish tartibida joylashtiramiz
    // Maqsad: 2 kishi uchun 10 kishilik stolni band qilib qo'ymaslik
    const suitableTables = restaurant.tables
      .filter(t => t.capacity >= guests)
      .sort((a, b) => a.capacity - b.capacity);

    if (suitableTables.length === 0) {
      setErrorMsg(t.noTables);
      setIsLoading(false);
      return;
    }

    // Eng optimal (kichikroq mos) stolni tanlaymiz
    const selectedTable = suitableTables[0];
    
    const url = `/${locale}/checkout?type=restaurant&entityId=${restaurant.id}&subEntityId=${selectedTable.id}&checkIn=${date}&slotTime=${slotTime}&guests=${guests}`;
    router.push(url);
  };

  return (
    <div id="booking-section" className="scroll-mt-24 rounded-xl border border-slate-200 bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
        {t.title}
      </h2>
      
      {restaurant.tables.length > 0 ? (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 mb-6 p-4 border border-slate-100 rounded-lg dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.dateLabel}
              </label>
              <DatePicker
                value={date}
                onChange={setDate}
                min={new Date().toISOString().split("T")[0]}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.timeLabel}
              </label>
              <TimePicker
                value={slotTime}
                onChange={setSlotTime}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                {t.guestsLabel}
              </label>
              <select
                value={guests}
                onChange={(e) => setGuests(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                {Array.from({ length: maxCapacity }, (_, i) => i + 1).map((n) => (
                  <option key={n} value={n}>
                    {n} {t.capacity}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {errorMsg && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <Button
            onClick={handleBookClick}
            disabled={isLoading}
            className="w-full bg-primary-600 font-extrabold text-white hover:bg-primary-700 py-3 shadow-md"
          >
            {isLoading ? t.processing : t.confirmBooking}
          </Button>
        </>
      ) : (
        <p className="text-sm text-slate-500">{t.noTables}</p>
      )}
    </div>
  );
}
