"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Utensils,
  CreditCard,
  X,
  ShieldCheck,
} from "lucide-react";
import { formatSum } from "@/lib/money";
import type { RestaurantDetailView } from "@safaar/api-client";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import type { Locale } from "@/i18n/config";
import type { CatalogDict } from "@/i18n/dictionaries";
import {
  PaymentSelector,
  type PaymentMethodId,
} from "@/components/features/checkout/PaymentSelector";

export function RestaurantBookingSection({
  dict,
  restaurant,
}: {
  restaurant: RestaurantDetailView;
  dict: CatalogDict["restaurants"];
}) {
  const params = useParams<{ lang?: string }>();
  const router = useRouter();
  const locale = params?.lang || "uz";
  const [selectedTableId, setSelectedTableId] = useState<string>(
    restaurant.tables[0]?.id ?? ""
  );
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [slotTime, setSlotTime] = useState<string>(
    restaurant.checkInTime || "18:00"
  );
  const [guests, setGuests] = useState<number>(2);
  const [guestName, setGuestName] = useState<string>("");
  const [guestPhone, setGuestPhone] = useState<string>("");
  const [guestEmail, setGuestEmail] = useState<string>("");
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const bDict = (dict as any).booking || {};

  // Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  // Karta turi (uzcard/humo/visa/mastercard) yoki "cash" — xom karta
  // raqami/CVV BU YERDA HECH QACHON so'ralmaydi (pastga qarang).
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("uzcard");

  const [loading, setLoading] = useState<boolean>(false);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedTable = restaurant.tables.find((t) => t.id === selectedTableId);
  const totalAmount = selectedTable?.basePriceSum ?? 0;

  const handleOpenModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim() || !guestPhone.trim()) {
      setErrorMsg(bDict.namePhoneRequired || "Iltimos, ismingiz va telefon raqamingizni kiriting");
      return;
    }
    setErrorMsg(null);
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setErrorMsg("Davom etish uchun Ommaviy Oferta shartlariga rozilik bering");
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const { api } = await import("@/lib/api");
      // MUHIM: xom karta raqami/CVV/amal qilish muddati bu yerda HECH
      // QACHON yig'ilmaydi va backendga yuborilmaydi. Karta to'lovi
      // (uzcard/humo/visa/mastercard) — Uzum Checkout'ning HAQIQIY hosted
      // (redirect) sahifasida amalga oshiriladi, xuddi mehmonxona bron
      // oqimidagi kabi (`lib/services/booking/actions.ts`).
      const booking = await api.bookings.createHotelBooking({
        hotelId: restaurant.id,
        roomId: selectedTableId || restaurant.id,
        checkIn: date,
        checkOut: date,
        slotTime: slotTime,
        guests: guests,
        totalPrice: totalAmount,
        guestName,
        guestPhone,
        guestEmail,
        source: "web-user",
        paymentMethod,
        agreeTerms,
      });

      if (paymentMethod === "cash") {
        // Naqd pul — backend booking'ni booking yaratishning bir qismi
        // sifatida DARHOL tasdiqlaydi (`confirmCashBookingIfNeeded()`).
        // To'lovning o'zi hali qilingani YO'Q (joyida olinadi) — shu
        // sabab pastdagi ekran "to'lov qilindi" emas, "bron tasdiqlandi"
        // deb ko'rsatadi.
        setSuccessBookingId(booking.bookingNumber || booking.id);
        setShowPaymentModal(false);
        return;
      }

      // Karta (uzcard/humo/visa/mastercard) — bu yerda HECH QACHON
      // muvaffaqiyat ko'rsatilmaydi: haqiqiy to'lov hali sodir bo'lgani
      // yo'q. Bron detail sahifasiga o'tkazamiz — u yerda RetryPaymentForm
      // haqiqiy fee/summani ko'rsatib, `POST /payments/:bookingId/create`
      // orqali HAQIQIY Uzum Checkout redirect URL'ini oladi (yoki backend
      // 503 `PAYMENT_PROVIDER_NOT_CONFIGURED` qaytarsa — aniq xato holati
      // ko'rsatiladi, muvaffaqiyat sifatida yashirilmaydi).
      const guestTokenParam = booking.guestAccessToken
        ? `&guestToken=${encodeURIComponent(booking.guestAccessToken)}`
        : "";
      router.push(
        `/${locale}/booking/${booking.id}?payment=pending&provider=${paymentMethod}${guestTokenParam}`,
      );
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : (bDict.error || "Xatolik yuz berdi"));
    } finally {
      setLoading(false);
    }
  };

  if (successBookingId) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-md dark:border-emerald-800 dark:bg-emerald-950/40">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h3 className="mt-3 text-xl font-extrabold text-emerald-900 dark:text-emerald-200">
          Bron tasdiqlandi!
        </h3>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
          Bron ID: <span className="font-mono font-bold">{successBookingId}</span>
        </p>
        <div className="mt-4 rounded-xl bg-emerald-100/60 p-3 text-left text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          <p><strong>{bDict.restaurantLabel || "Restoran:"}</strong> {restaurant.name}</p>
          <p><strong>{bDict.tableLabel || "Stol:"}</strong> {selectedTable?.name?.startsWith("Stol") ? selectedTable.name.replace("Stol", bDict.table || "Stol") : selectedTable?.name}</p>
          <p><strong>{bDict.dateTimeLabel || "Sana va vaqt:"}</strong> {date} ({slotTime})</p>
          <p><strong>{bDict.clientLabel || "Mijoz:"}</strong> {guestName} ({guestPhone})</p>
          <p><strong>To'lov usuli:</strong> Naqd pul — joyga kelganingizda to&apos;lanadi</p>
        </div>
        <Button
          onClick={() => setSuccessBookingId(null)}
          variant="secondary"
          className="mt-6 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
        >{bDict.newBooking || "Yangi bron qilish"}</Button>
      </div>
    );
  }

  return (
    <>
      <div
        id="booking-section"
        className="scroll-mt-24 rounded-xl border border-slate-200 bg-card p-6 shadow-md dark:border-slate-800 dark:bg-slate-900"
      >
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
          <Utensils className="h-5 w-5 text-primary-600 dark:text-primary-400" />{bDict.title || "Stol bron qilish"}</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{bDict.selectTimeGuests || "Kechki ovqat yoki tushlik uchun stolni oldindan band qiling"}</p>

        {errorMsg && !showPaymentModal && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleOpenModal} className="mt-5 space-y-4">
          {/* Table Selection */}
          {restaurant.tables.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{bDict.selectTable || "Stolni tanlang"}</label>
              <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {restaurant.tables.map((tbl) => (
                  <button
                    key={tbl.id}
                    type="button"
                    onClick={() => setSelectedTableId(tbl.id)}
                    className={`flex flex-col rounded-xl border p-2.5 text-left text-xs transition-all ${
                      selectedTableId === tbl.id
                        ? "border-primary-600 bg-primary-50 ring-2 ring-primary-500 dark:border-primary-500 dark:bg-primary-950/50"
                        : "border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                    }`}
                  >
                    <span className="font-bold text-slate-900 dark:text-white">
                      {tbl.name.startsWith("Stol") ? tbl.name.replace("Stol", bDict.table || "Stol") : tbl.name}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {tbl.capacity} kishilik
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Date and Time */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Calendar className="mr-1 inline-block h-3.5 w-3.5" />{bDict.date || "Sana"}</label>
              <div className="mt-1 w-full">
                <DatePicker
                  locale={locale as Locale}
                  value={date}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(newDate) => setDate(newDate)}
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                <Clock className="mr-1 inline-block h-3.5 w-3.5" />{bDict.time || "Kelish vaqti"}</label>
              <input
                type="time"
                value={slotTime}
                onChange={(e) => setSlotTime(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Guests Count */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{bDict.guestsCount || "Kishilar soni"}</label>
            <input
              type="number"
              min={1}
              max={20}
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              required
            />
          </div>

          {/* Contact Info */}
          <div className="space-y-2.5 border-t border-slate-100 pt-3 dark:border-slate-800">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{bDict.nameRequired || "Ismingiz *"}</label>
              <input
                type="text"
                placeholder={bDict.namePlaceholder || "Masalan: Ali Valiyev"}
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{bDict.phoneRequired || "Telefon raqamingiz *"}</label>
              <input
                type="tel"
                placeholder={bDict.phonePlaceholder || "+998 90 123 45 67"}
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{bDict.emailOptional || "Email (ixtiyoriy)"}</label>
              <input
                type="email"
                placeholder={bDict.emailPlaceholder || "ali@example.com"}
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary-600 font-extrabold text-white hover:bg-primary-700 py-3"
          >{bDict.bookTable || "Stolni bron qilish"}</Button>
        </form>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <button
              type="button"
              onClick={() => setShowPaymentModal(false)}
              className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>

            <h3 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
              <CreditCard className="h-5 w-5 text-primary-600 dark:text-primary-400" />{bDict.modalTitle || "To'lovni amalga oshirish"}</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {restaurant.name} · {selectedTable?.name?.startsWith("Stol") ? selectedTable.name.replace("Stol", bDict.table || "Stol") : selectedTable?.name}
            </p>

            {errorMsg && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                {errorMsg}
              </div>
            )}

            {/* Order Summary box */}
            <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs dark:bg-slate-800/60">
              <div className="flex justify-between py-1">
                <span className="text-slate-500 dark:text-slate-400">{bDict.dateTimeLabel || "Sana & Vaqt:"}</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {date} ({slotTime})
                </span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 dark:text-slate-400">{bDict.clientLabel || "Mijoz:"}</span>
                <span className="font-semibold text-slate-900 dark:text-white">
                  {guestName} ({guestPhone})
                </span>
              </div>
              <div className="flex justify-between border-t border-slate-200/60 pt-2 text-sm font-bold dark:border-slate-700">
                <span className="text-slate-900 dark:text-white">{bDict.totalAmount || "Jami summa:"}</span>
                <span className="text-primary-600 dark:text-primary-400">
                  {totalAmount > 0 ? formatSum(totalAmount) : (bDict.freeBooking || "Bepul (Stol band etish)")}
                </span>
              </div>
            </div>

            <form onSubmit={handleProcessPayment} className="mt-4 space-y-4">
              {/* Payment Method Selector — checkout formasi (mehmonxona
                  bron oqimi) bilan BIR XIL, qayta ishlatiladigan komponent.
                  Karta turi (uzcard/humo/visa/mastercard) faqat FEE
                  stavkasini belgilaydi — hammasi Uzum Checkout orqali
                  (hosted/redirect sahifa). */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {bDict.paymentType || "To'lov usuli"}
                </label>
                <div className="mt-1.5">
                  <PaymentSelector
                    defaultValue={paymentMethod}
                    name="paymentMethod"
                    onChange={setPaymentMethod}
                  />
                </div>
              </div>

              {/* Karta tanlansa — xom karta raqami/CVV BU YERDA umuman
                  so'ralmaydi. Haqiqiy to'lov keyingi qadamda (bron detail
                  sahifasida) to'lov provayderining HAQIQIY xavfsiz
                  sahifasiga redirect orqali amalga oshiriladi. */}
              {paymentMethod !== "cash" && (
                <div className="flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50/50 p-3 text-[11px] text-slate-600 dark:border-slate-800 dark:bg-slate-800/40 dark:text-slate-300">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                  <span>
                    Karta ma&apos;lumotlarini keyingi qadamda to&apos;lov
                    provayderining (Uzum Checkout) o&apos;z xavfsiz
                    sahifasida kiritasiz — SAFAAR karta raqamingizni
                    so&apos;ramaydi va saqlamaydi.
                  </span>
                </div>
              )}

              {paymentMethod === "cash" && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />{bDict.cashNote || "Stol band qilinadi. To'lov restoranga yetib kelganingizda amalga oshiriladi."}</div>
              )}

              <label className="flex items-start gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  required
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-slate-600 dark:text-slate-400 leading-tight">
                  Men{" "}
                  <Link
                    href={`/${locale}/terms`}
                    target="_blank"
                    className="font-semibold text-primary-600 hover:underline"
                  >
                    Ommaviy Oferta
                  </Link>{" "}
                  shartlariga roziman.
                </span>
              </label>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 font-extrabold text-white hover:bg-primary-700 py-3 shadow-md"
              >
                {loading
                  ? paymentMethod === "cash"
                    ? "Bron tasdiqlanmoqda..."
                    : "To'lov sahifasiga o'tilmoqda..."
                  : paymentMethod === "cash"
                  ? "Bronni tasdiqlash (Naqd)"
                  : `${totalAmount > 0 ? formatSum(totalAmount) : "To'lovni tasdiqlash"}`}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
