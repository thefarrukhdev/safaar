import { formatSum } from '@/lib/money';
import { Button } from '@/components/ui/Button';
import type { HotelDetailDict } from '@/i18n/dictionaries';

export function HotelBookingWidget({
  minPriceSum,
  checkInTime,
  checkOutTime,
  dict,
}: {
  minPriceSum: number;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  dict: HotelDetailDict;
}) {
  return (
    <aside className="flex h-fit flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-xl lg:sticky lg:top-24">
      <div>
        <p className="flex items-end gap-1.5 text-3xl font-black tracking-tight text-slate-900">
          {formatSum(minPriceSum)}
          <span className="mb-1 text-base font-normal text-slate-500">
            {dict.perNight}
          </span>
        </p>
      </div>

      <div className="flex flex-col rounded-xl border border-slate-300">
        <div className="flex border-b border-slate-300">
          <div className="flex flex-1 flex-col border-r border-slate-300 p-3">
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
        <Button
          variant="accent"
          size="lg"
          className="w-full font-extrabold"
        >
          {dict.selectRoom || dict.booking.checkAvailability}
        </Button>
      </a>

      <div className="flex justify-center">
        <span className="text-sm text-slate-500">{dict.booking.noChargeNotice}</span>
      </div>

      <div className="flex flex-col gap-3 pt-4 border-t border-slate-200">
        <div className="flex justify-between text-base text-slate-600 underline">
          <span>{formatSum(minPriceSum)} x {dict.booking.nightsCount.replace("{count}", "5")}</span>
          <span>{formatSum(minPriceSum * 5)}</span>
        </div>
        <div className="flex justify-between text-base text-slate-600 underline">
          <span>{dict.booking.serviceFee}</span>
          <span>{formatSum(10000)}</span>
        </div>
      </div>

      <div className="flex justify-between border-t border-slate-200 pt-4 text-lg font-bold text-slate-900">
        <span>{dict.booking.total}</span>
        <span>{formatSum(minPriceSum * 5 + 10000)}</span>
      </div>
    </aside>
  );
}
