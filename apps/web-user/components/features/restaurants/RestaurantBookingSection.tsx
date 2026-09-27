"use client";
import { bookingTranslations } from "./i18n";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RestaurantDetailView } from "@safaar/api-client";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
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

  const t = bookingTranslations[locale as keyof typeof bookingTranslations] || bookingTranslations.uz;

  const handleTableClick = (tblId: string) => {
    const guests = restaurant.tables.find(t => t.id === tblId)?.capacity || 2;
    const url = `/${locale}/checkout?type=restaurant&entityId=${restaurant.id}&subEntityId=${tblId}&checkIn=${date}&slotTime=${slotTime}&guests=${guests}`;
    router.push(url);
  };

  return (
    <div id="booking-section" className="scroll-mt-24 rounded-xl border border-slate-200 bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
        {(dict as any).detail?.availableTables || t.selectTable}
      </h2>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6 p-4 border border-slate-100 rounded-lg dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50">
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
      </div>

      {restaurant.tables.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-2">
          {restaurant.tables.map((tbl) => (
            <button
              key={tbl.id}
              type="button"
              onClick={() => handleTableClick(tbl.id)}
              className="flex flex-col rounded-xl border border-slate-200 p-4 text-left transition-all hover:bg-slate-50 hover:border-primary-300 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:border-primary-700"
            >
              <span className="font-bold text-slate-900 dark:text-white">
                {tbl.name.startsWith("Stol") ? tbl.name.replace("Stol", t.table) : tbl.name}
              </span>
              <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {tbl.capacity} {t.capacity}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <p className="text-sm text-slate-500">{t.noTables}</p>
      )}
    </div>
  );
}
