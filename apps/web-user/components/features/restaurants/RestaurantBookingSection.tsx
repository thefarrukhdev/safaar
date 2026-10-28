"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Utensils,
  CreditCard,
  Banknote,
  Users,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { formatSum } from "@/lib/money";
import type { RestaurantDetailView } from "@safaar/api-client";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { Modal } from "@/components/ui/Modal";
import type { CatalogDict } from "@/i18n/dictionaries";
import { PaymentSelector, type PaymentMethodId } from "@/components/features/checkout/PaymentSelector";

function getSuggestedTimeSlots(checkIn?: string, checkOut?: string): string[] {
  const startHour = checkIn ? parseInt(checkIn.split(":")[0], 10) : 10;
  const endHour = checkOut ? parseInt(checkOut.split(":")[0], 10) : 23;

  if (isNaN(startHour) || isNaN(endHour)) {
    return ["12:00", "13:00", "18:00", "19:00", "20:00", "21:00"];
  }

  const slots: string[] = [];
  if (startHour <= endHour) {
    const step = endHour - startHour > 8 ? 2 : 1;
    for (let h = startHour; h < endHour; h += step) {
      slots.push(`${String(h).padStart(2, "0")}:00`);
    }
  } else {
    // Overnight operating hours (e.g. 20:00 to 04:00)
    for (let h = startHour; h <= 23; h += 2) {
      slots.push(`${String(h).padStart(2, "0")}:00`);
    }
    for (let h = 0; h < endHour; h += 2) {
      slots.push(`${String(h).padStart(2, "0")}:00`);
    }
  }

  return slots.length > 0 ? slots.slice(0, 8) : ["12:00", "13:00", "18:00", "19:00", "20:00", "21:00"];
}

function mapErrorCode(code: string): string {
  switch (code) {
    case "SLOT_OUTSIDE_HOURS":
      return "Tanlangan vaqt restoran ish vaqtidan tashqarida. Iltimos, ish vaqti oralig'idagi vaqtni tanlang.";
    case "TABLE_ALREADY_BOOKED":
      return "Ushbu stol tanlangan vaqtda allaqachon band qilingan. Iltimos, boshqa vaqt yoki stolni tanlang.";
    case "ROOM_NOT_AVAILABLE":
      return "Ushbu stol ayni paytda band qilish uchun mavjud emas.";
    case "BOOKING_DATES_INVALID":
      return "Iltimos, to'g'ri sana va kelish vaqtini tanlang.";
    case "TERMS_NOT_ACCEPTED":
      return "Ommaviy oferta shartlariga rozilik bildirishingiz kerak.";
    case "USER_BLOCKED":
      return "Ushbu hisobdan bron qilish vaqtincha cheklangan.";
    default:
      return code || "Bron qilishda xatolik yuz berdi. Qaytadan urinib ko'ring.";
  }
}

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
  const router = useRouter();
  const locale = params?.lang || "uz";

  const suggestedSlots = useMemo(
    () => getSuggestedTimeSlots(restaurant.checkInTime, restaurant.checkOutTime),
    [restaurant.checkInTime, restaurant.checkOutTime]
  );

  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [date, setDate] = useState<string>(new Date().toISOString().split("T")[0]);
  const [slotTime, setSlotTime] = useState<string>(
    suggestedSlots.includes("19:00") ? "19:00" : suggestedSlots[0] || "18:00"
  );
  const [guests, setGuests] = useState<number>(2);

  const [guestName, setGuestName] = useState<string>("");
  const [guestPhone, setGuestPhone] = useState<string>("+998");
  const [guestEmail, setGuestEmail] = useState<string>("");

  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("cash");
  const [agreeTerms, setAgreeTerms] = useState<boolean>(true);

  const [loading, setLoading] = useState<boolean>(false);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const bDict = (dict as any).booking || {};
  const selectedTable = restaurant.tables.find((t) => t.id === selectedTableId);
  const totalAmount = selectedTable?.basePriceSum ?? 0;
  const isFreeBooking = totalAmount === 0;

  const handleTableClick = (tblId: string) => {
    setSelectedTableId(tblId);
    const table = restaurant.tables.find((t) => t.id === tblId);
    if (table) {
      setGuests(Math.min(table.capacity, 4));
    }
    setErrorMsg(null);
    setShowBookingModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setErrorMsg(bDict.acceptTermsError || "Ommaviy oferta shartlariga rozi bo'lishingiz kerak.");
      return;
    }

    if (!guestName.trim()) {
      setErrorMsg(bDict.namePhoneRequired || "Iltimos, ismingizni kiriting.");
      return;
    }

    if (guestPhone.length < 9) {
      setErrorMsg(bDict.namePhoneRequired || "Iltimos, to'liq telefon raqamingizni kiriting.");
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const { createRestaurantBookingAction } = await import(
        "@/lib/services/booking/actions"
      );

      const resolvedPayment = isFreeBooking ? "cash" : paymentMethod;

      const res = await createRestaurantBookingAction({
        restaurantId: restaurant.id,
        tableId: selectedTableId || restaurant.tables[0]?.id || restaurant.id,
        date,
        slotTime,
        guests,
        totalPrice: totalAmount,
        guestName,
        guestPhone,
        guestEmail,
        paymentMethod: resolvedPayment,
        agreeTerms,
      });

      if (!res.ok || !res.bookingId) {
        setErrorMsg(mapErrorCode(res.error || ""));
        return;
      }

      if (resolvedPayment === "cash" || isFreeBooking) {
        setSuccessBookingId(res.bookingNumber || res.bookingId);
        setShowBookingModal(false);
        return;
      }

      // Karta orqali to'lov uchun to'lov sahifasiga o'tkazish
      const guestTokenParam = res.guestAccessToken
        ? `&guestToken=${encodeURIComponent(res.guestAccessToken)}`
        : "";
      router.push(
        `/${locale}/booking/${res.bookingId}?payment=pending&provider=${resolvedPayment}${guestTokenParam}`
      );
    } catch (err: unknown) {
      setErrorMsg(bDict.error || "Xatolik yuz berdi. Qaytadan urinib ko'ring.");
    } finally {
      setLoading(false);
    }
  };

  if (successBookingId) {
    return (
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-b from-emerald-50/80 to-white p-6 text-center shadow-lg">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 shadow-xs">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h3 className="mt-4 text-xl font-extrabold text-slate-900">
          Stol muvaffaqiyatli band qilindi!
        </h3>
        <p className="mt-1 text-sm text-slate-600">
          Bron raqami: <span className="font-mono font-bold text-emerald-700">{successBookingId}</span>
        </p>

        <div className="mt-5 space-y-2 rounded-xl bg-slate-50 p-4 text-left text-xs text-slate-700 border border-slate-200/80">
          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500">Restoran:</span>
            <span className="font-semibold text-slate-900">{restaurant.name}</span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500">Stol:</span>
            <span className="font-semibold text-slate-900">
              {selectedTable?.name || "Tanlangan stol"}
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500">Sana va vaqt:</span>
            <span className="font-semibold text-slate-900">
              {date} · {slotTime}
            </span>
          </div>
          <div className="flex justify-between border-b border-slate-200/60 pb-2">
            <span className="text-slate-500">Mehmonlar:</span>
            <span className="font-semibold text-slate-900">{guests} kishi</span>
          </div>
          <div className="flex justify-between pt-1">
            <span className="text-slate-500">To'lov:</span>
            <span className="font-semibold text-emerald-700">
              {isFreeBooking ? "Bepul bron" : `${formatSum(totalAmount)} (Joyida to'lanadi)`}
            </span>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Link
            href={`/${locale}/account`}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
          >
            Mening bronlarim sahifasiga o'tish
          </Link>
          <Button
            onClick={() => setSuccessBookingId(null)}
            variant="secondary"
            className="h-10 text-xs"
          >
            Yana boshqa stol ko'rish
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        id="booking-section"
        className="rounded-2xl border border-slate-200/80 bg-white p-5 sm:p-6 shadow-sm"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900">
              {bDict.title || "Stol bron qilish"}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Restoranga tashrifingizni oldindan rejalashtiring
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <Utensils className="h-5 w-5" />
          </div>
        </div>

        {/* Operating Hours Banner */}
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs text-slate-600 border border-slate-100">
          <Clock className="h-4 w-4 text-slate-400 shrink-0" />
          <span>
            Ish vaqti:{" "}
            <strong className="text-slate-800">
              {restaurant.workingHours || restaurant.openingHours || "10:00 - 23:00"}
            </strong>
          </span>
        </div>

        {/* Tables List */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Mavjud stollar ({restaurant.tables.length})
            </span>
            <span className="text-xs text-slate-400">Kerakli stolni tanlang</span>
          </div>

          {restaurant.tables.length > 0 ? (
            <div className="flex flex-col gap-3">
              {restaurant.tables.map((tbl) => {
                const isFree = tbl.basePriceSum === 0;
                return (
                  <div
                    key={tbl.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 transition-all hover:border-emerald-400 hover:shadow-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900 text-sm">
                          {tbl.name}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          <Users className="h-3 w-3" />
                          {tbl.capacity} kishilik
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        {isFree ? (
                          <span className="inline-flex items-center gap-1 font-semibold text-emerald-600">
                            <Sparkles className="h-3 w-3" />
                            Bepul bron
                          </span>
                        ) : (
                          <span className="font-semibold text-slate-800">
                            {formatSum(tbl.basePriceSum)} depozit
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleTableClick(tbl.id)}
                      className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-4 h-9 shadow-xs"
                    >
                      <span>Bron qilish</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500">
              {bDict.noTables || "Hozircha faol stollar ro'yxati e'lon qilinmagan"}
            </div>
          )}
        </div>

        {/* Guarantee Info */}
        <div className="mt-6 flex items-start gap-2.5 rounded-xl bg-blue-50/60 p-3 text-xs text-blue-900/80 border border-blue-100">
          <ShieldCheck className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
          <span>
            Safaar orqali bron qilingan stollar restoran tomonidan kafolatlanadi.
          </span>
        </div>
      </div>

      {/* Booking Checkout Modal */}
      <Modal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        maxWidth="max-w-lg"
      >
        <div className="flex flex-col p-1">
          {/* Header */}
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <Utensils className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                Stolni band qilish
              </h2>
              <p className="text-xs text-slate-500">
                {restaurant.name} · {selectedTable?.name || "Tanlangan stol"}
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleProcessPayment} className="mt-4 space-y-4">
            {/* Table Summary Box */}
            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3 border border-slate-200/80 text-xs">
              <div>
                <span className="text-slate-500 block">Tanlangan stol:</span>
                <span className="font-bold text-slate-900 text-sm">
                  {selectedTable?.name}
                </span>
              </div>
              <div className="text-right">
                <span className="text-slate-500 block">Depozit summasi:</span>
                <span className="font-bold text-emerald-700 text-sm">
                  {isFreeBooking ? "Bepul" : formatSum(totalAmount)}
                </span>
              </div>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kelish sanasi *
                </label>
                <DatePicker
                  value={date}
                  onChange={setDate}
                  min={new Date().toISOString().split("T")[0]}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mehmonlar soni *
                </label>
                <select
                  value={guests}
                  onChange={(e) => setGuests(Number(e.target.value))}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  {Array.from(
                    { length: Math.max(selectedTable?.capacity || 4, 12) },
                    (_, i) => i + 1
                  ).map((n) => (
                    <option key={n} value={n}>
                      {n} kishi {n > (selectedTable?.capacity || 4) ? "(qo'shimcha)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Time Slot Picker with suggested chips */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">
                  Kelish vaqti *
                </label>
                <span className="text-[11px] text-slate-500">
                  Ish vaqti: {restaurant.workingHours || restaurant.openingHours || "10:00 - 23:00"}
                </span>
              </div>

              {/* Suggested quick chips */}
              {suggestedSlots.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {suggestedSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => setSlotTime(slot)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                        slotTime === slot
                          ? "bg-emerald-600 text-white shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                      }`}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              )}

              <div className="relative">
                <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="time"
                  value={slotTime}
                  onChange={(e) => setSlotTime(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Guest Details */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ismingiz *
                </label>
                <input
                  type="text"
                  placeholder="Ali Valiyev"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Telefon raqam *
                </label>
                <input
                  type="tel"
                  placeholder="+998 90 123 45 67"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
              </div>
            </div>

            {/* Payment Mode Selection */}
            {!isFreeBooking ? (
              <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-3">
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  To'lov usuli (Depozit uchun)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-medium transition ${
                      paymentMethod === "cash"
                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-1 ring-emerald-500"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <Banknote className="h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="font-semibold">Naqd (Joyida)</div>
                      <div className="text-[10px] text-slate-500">Yetib kelgach to'lanadi</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("uzcard")}
                    className={`flex items-center gap-2 rounded-xl border p-2.5 text-left text-xs font-medium transition ${
                      paymentMethod !== "cash"
                        ? "border-emerald-500 bg-emerald-50/50 text-emerald-900 ring-1 ring-emerald-500"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    <CreditCard className="h-4 w-4 text-blue-600" />
                    <div>
                      <div className="font-semibold">Karta orqali</div>
                      <div className="text-[10px] text-slate-500">Uzcard / Humo / Visa</div>
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200/60">
                <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
                <span>
                  Ushbu stol bepul band qilinadi. Hech qanday oldindan to'lov talab etilmaydi!
                </span>
              </div>
            )}

            {/* Terms checkbox */}
            <label className="flex items-start gap-2 pt-1 cursor-pointer">
              <input
                type="checkbox"
                checked={agreeTerms}
                onChange={(e) => setAgreeTerms(e.target.checked)}
                className="mt-0.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-[11px] text-slate-500">
                Men{" "}
                <Link
                  href={`/${locale}/terms`}
                  target="_blank"
                  className="font-medium text-emerald-700 underline"
                >
                  Ommaviy Oferta shartlari
                </Link>
                ga va restoran tartib-qoidalariga rozilik bildiraman.
              </span>
            </label>

            {/* Submit Button */}
            <div className="pt-2">
              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm shadow-sm"
              >
                {loading
                  ? "Band qilinmoqda..."
                  : isFreeBooking
                  ? "Stolni bepul band qilish"
                  : `Bronni tasdiqlash (${formatSum(totalAmount)})`}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
