import { formatSum } from "@/lib/money";
import type { HotelDetailDict } from '@/i18n/dictionaries';

export function HotelBookingWidget({
  minPriceSum,
  checkIn,
  checkOut,
  dict,
  locale,
}: {
  minPriceSum: number;
  checkIn?: string | null;
  checkOut?: string | null;
  dict: HotelDetailDict;
  locale: string;
}) {
  return (
    <aside className="hidden lg:flex h-fit flex-col gap-5 rounded-xl border border-slate-900/[0.08] bg-white p-6 shadow-float sticky top-24">
      <div>
        {minPriceSum > 0 ? (
          <p className="flex items-end gap-1.5 text-3xl font-black tracking-tight text-slate-900">
            {new Intl.NumberFormat('ru-RU').format(minPriceSum)}
            <span className="mb-1 text-base font-normal text-slate-500">
              {locale === 'ru' ? 'сум' : locale === 'en' ? 'UZS' : "so'm"} / {dict.perNight}
            </span>
          </p>
        ) : (
          <p className="text-2xl font-bold text-slate-900">
            {dict.rooms?.title || "Xonalar"}
          </p>
        )}
      </div>

      {/* Check-in / Check-out soxta (ishlamaydigan) bloki foydalanuvchi xohishiga ko'ra olib tashlandi */}

      <a href="#rooms" id="hotel-original-cta" className="w-full">
        <button
          type="button"
          className="inline-flex h-12 max-md:h-11 w-full items-center justify-center gap-2 rounded-full border border-blue-700/50 bg-blue-600 px-6 text-base font-medium text-white transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-blue-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {dict.selectRoom || dict.booking.checkAvailability}
        </button>
      </a>
    </aside>
  );
}
