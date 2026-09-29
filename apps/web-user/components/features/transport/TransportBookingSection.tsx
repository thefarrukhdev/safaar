"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar,
  Car,
} from "lucide-react";
import { formatSum } from "@/lib/money";
import type { TransportDetailView } from "@safaar/api-client";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";

function daysBetween(checkIn: string, checkOut: string): number {
  const start = Date.parse(checkIn);
  const end = Date.parse(checkOut);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

export function TransportBookingSection({
  dict,
  transport,
  isLoggedIn = false,
}: {
  transport: TransportDetailView;
  dict: any;
  isLoggedIn?: boolean;
}) {
  const params = useParams<{ lang?: string }>();
  const locale = params?.lang || "uz";
  const router = useRouter();

  const todayDate = new Date();
  const today = todayDate.toISOString().split("T")[0];
  const [checkIn, setCheckIn] = useState<string>(today);
  const [checkOut, setCheckOut] = useState<string>(() => {
    const tomorrow = new Date(todayDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  
  const bDict = (dict as any).booking || {};
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const days = useMemo(() => daysBetween(checkIn, checkOut), [checkIn, checkOut]);
  const totalAmount = days > 0 ? days * transport.pricePerDaySum : 0;

  const handleBookClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (days <= 0) {
      setErrorMsg(bDict.dateOrderError || "Qaytarish sanasi olib ketish sanasidan keyin bo'lishi kerak");
      return;
    }
    setErrorMsg(null);

    // Redirect directly to checkout
    router.push(`/${locale}/checkout?type=transport&entityId=${transport.id}&checkIn=${checkIn}&checkOut=${checkOut}`);
  };

  return (
    <div
      id="booking-section"
      className="scroll-mt-24 rounded-xl border border-slate-200 bg-card p-6"
    >
      <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900">
        <Car className="h-5 w-5 text-primary-600" />{bDict.title || "Mashinani band qilish"}
      </h2>
      <p className="mt-1 text-xs text-slate-500">
        {formatSum(transport.pricePerDaySum)} / kuniga
      </p>

      {errorMsg && (
        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleBookClick} className="mt-5 space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              <Calendar className="mr-1 inline-block h-3.5 w-3.5" />{bDict.pickup || "Olib ketish"}
            </label>
            <DatePicker
              locale={locale as "uz" | "ru" | "en"}
              label=""
              value={checkIn}
              onChange={setCheckIn}
              min={today}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              <Calendar className="mr-1 inline-block h-3.5 w-3.5" />{bDict.return || "Qaytarish"}
            </label>
            <DatePicker
              locale={locale as "uz" | "ru" | "en"}
              label=""
              value={checkOut}
              onChange={setCheckOut}
              min={checkIn || today}
            />
          </div>
        </div>

        {days > 0 && (
          <div className="flex items-center justify-between rounded-xl bg-white px-3.5 py-2.5 text-xs">
            <span className="text-slate-500">
              {((dict as any).booking?.daysCount || "{days} kun").replace("{days}", days.toString())}
            </span>
            <span className="font-bold text-slate-900">
              {formatSum(totalAmount)}
            </span>
          </div>
        )}

        <Button
          type="submit"
          className="mt-6 w-full bg-primary-600 font-bold text-white hover:bg-primary-700 py-4"
        >
          {bDict.bookNow || "Bron qilish"}
        </Button>
      </form>
    </div>
  );
}
