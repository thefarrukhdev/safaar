import { formatSum } from '@/lib/money';
import type { HotelDetailDict } from '@/i18n/dictionaries';

export function HotelBookingWidget({
  minPriceSum,
  checkInTime,
  checkOutTime,
  dict,
  locale,
}: {
  minPriceSum: number;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  dict: HotelDetailDict;
  locale: string;
}) {
  return (
    <aside className="flex h-fit flex-col gap-5 rounded-xl border border-slate-900/[0.08] bg-white p-6 shadow-float lg:sticky lg:top-24">
      <div>
        <p className="flex items-end gap-1.5 text-3xl font-black tracking-tight text-slate-900">
          {formatSum(minPriceSum, locale)}
          <span className="mb-1 text-base font-normal text-slate-500">
            {dict.perNight}
          </span>
        </p>
      </div>

      <div className="flex flex-col rounded-xl border border-slate-900/[0.08]">
        <div className="flex border-b border-slate-900/[0.08]">
          <div className="flex flex-1 flex-col border-r border-slate-900/[0.08] p-3">
            <span className="text-[10px] font-bold uppercase text-slate-900">{dict.booking.checkIn}</span>
            <span className="text-sm text-slate-500">{checkInTime || dict.booking.addDate}</span>
          </div>
          <div className="flex flex-1 flex-col p-3">
            <span className="text-[10px] font-bold uppercase text-slate-900">{dict.booking.checkOut}</span>
            <span className="text-sm text-slate-500">{checkOutTime || dict.booking.addDate}</span>
          </div>
        </div>
        <div className="flex flex-col p-3">
          <span className="text-[10px] font-bold uppercase text-slate-900">{dict.booking.guests}</span>
          <span className="text-sm text-slate-500">{dict.booking.oneGuest}</span>
        </div>
      </div>

      <a href="#rooms" id="hotel-original-cta" className="w-full">
        <button
          type="button"
          className="inline-flex h-12 max-md:h-11 w-full items-center justify-center gap-2 rounded-full border border-blue-700/50 bg-blue-600 px-6 text-base font-medium text-white  transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-blue-700 active:scale-[0.97]  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          {dict.selectRoom || dict.booking.checkAvailability}
        </button>
      </a>

      <div className="flex justify-center">
        <span className="text-sm text-slate-500">{dict.booking.noChargeNotice}</span>
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t border-slate-900/[0.08]">
        <div className="flex justify-between text-base text-slate-600 underline">
          <span>{formatSum(minPriceSum, locale)} x {dict.booking.nightsCount.replace("{count}", "5")}</span>
          <span>{formatSum(minPriceSum * 5, locale)}</span>
        </div>
        <div className="flex justify-between text-base text-slate-600 underline">
          <span>{dict.booking.serviceFee}</span>
          <span>{formatSum(10000, locale)}</span>
        </div>
      </div>

      <div className="flex justify-between border-t border-slate-900/[0.08] pt-4 text-lg font-bold text-slate-900">
        <span>{dict.booking.total}</span>
        <span>{formatSum(minPriceSum * 5 + 10000, locale)}</span>
      </div>
    </aside>
  );
}
