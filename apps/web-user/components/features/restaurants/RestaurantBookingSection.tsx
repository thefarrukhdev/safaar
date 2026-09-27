"use client";
import { bookingTranslations } from "./i18n";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import type { RestaurantDetailView } from "@safaar/api-client";
import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import type { CatalogDict } from "@/i18n/dictionaries";
import { Calendar, Clock, Users } from "lucide-react";

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

  const guestOptions = Array.from({ length: maxCapacity }, (_, i) => i + 1).map((n) => ({
    value: String(n),
    label: `${n} ${t.capacity}`,
  }));


  const handleBookClick = () => {
    setErrorMsg(null);
    setIsLoading(true);

    const suitableTables = restaurant.tables
      .filter(t => t.capacity >= guests)
      .sort((a, b) => a.capacity - b.capacity);

    if (suitableTables.length === 0) {
      setErrorMsg(t.noTables);
      setIsLoading(false);
      return;
    }

    const selectedTable = suitableTables[0];
    
    const url = `/${locale}/checkout?type=restaurant&entityId=${restaurant.id}&subEntityId=${selectedTable.id}&checkIn=${date}&slotTime=${slotTime}&guests=${guests}`;
    router.push(url);
  };

  return (
    <div id="booking-section" className="scroll-mt-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/40 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 to-blue-600"></div>
      
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {t.title}
        </h2>
      </div>
      
      {restaurant.tables.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {/* Date Field - Full Width */}
            <div className="w-full">
              <DatePicker
                label={t.dateLabel}
                value={date}
                onChange={setDate}
                min={new Date().toISOString().split("T")[0]}
                icon={<Calendar className="h-4 w-4" />}
              />
            </div>
            
            {/* Time and Guests - 2 Columns */}
            <div className="grid grid-cols-2 gap-3 w-full">
              <div className="w-full">
                <TimePicker
                  label={t.timeLabel}
                  value={slotTime}
                  onChange={setSlotTime}
                  icon={<Clock className="h-4 w-4" />}
                />
              </div>
              <div className="w-full">
                <Select
                  label={t.guestsLabel}
                  value={String(guests)}
                  onChange={(val) => setGuests(Number(val))}
                  options={guestOptions}
                  placeholder={t.guestsLabel}
                  icon={<Users className="h-4 w-4" />}
                />
              </div>
            </div>
          </div>

          {errorMsg && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400 flex items-start gap-2">
              <div className="mt-0.5 shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <span>{errorMsg}</span>
            </div>
          )}

          <Button
            onClick={handleBookClick}
            disabled={isLoading}
            className="w-full mt-2 rounded-xl py-6 text-[15px] font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all active:scale-[0.98] shadow-md hover:shadow-lg disabled:opacity-70 disabled:active:scale-100"
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                {t.processing}
              </span>
            ) : (
              t.confirmBooking
            )}
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center dark:border-slate-800 dark:bg-slate-800/50">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800">
            <Users className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 dark:text-slate-400">{t.noTables}</p>
        </div>
      )}
    </div>
  );
}
