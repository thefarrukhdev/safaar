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
import { Modal } from "@/components/ui/Modal";
import type { CatalogDict } from "@/i18n/dictionaries";
import {
  PaymentSelector,
  type PaymentMethodId,
} from "@/components/features/checkout/PaymentSelector";

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

  // No initial table selected, user must click one
  const [selectedTableId, setSelectedTableId] = useState<string>("");
  const [date, setDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [slotTime, setSlotTime] = useState<string>("19:00");
  const [guests, setGuests] = useState<number>(2);

  const [guestName, setGuestName] = useState<string>("");
  const [guestPhone, setGuestPhone] = useState<string>("+998");
  const [guestEmail, setGuestEmail] = useState<string>("");

  const [showBookingModal, setShowBookingModal] = useState<boolean>(false);
  // Karta turi (uzcard/humo/visa/mastercard) yoki "cash" — xom karta
  // raqami/CVV BU YERDA HECH QACHON so'ralmaydi (pastga qarang).
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("uzcard");
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const bDict = (dict as any).booking || {};
  const selectedTable = restaurant.tables.find((t) => t.id === selectedTableId);
  const totalAmount = selectedTable?.basePriceSum ?? 0;

  const handleTableClick = (tblId: string) => {
    setSelectedTableId(tblId);
    setGuests(restaurant.tables.find((t) => t.id === tblId)?.capacity || 2);
    setShowBookingModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setErrorMsg(bDict.acceptTermsError || "Ommaviy oferta shartlariga rozi bo'lishingiz kerak.");
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
        setShowBookingModal(false);
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
      setErrorMsg(bDict.error || "Xatolik yuz berdi");
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
      <div id="booking-section" className="scroll-mt-24 rounded-xl border border-slate-200 bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
          {(dict as any).detail?.availableTables || bDict.selectTable || "Stolni tanlang"}
        </h2>
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
                  {tbl.name.startsWith("Stol") ? tbl.name.replace("Stol", bDict.table || "Stol") : tbl.name}
                </span>
                <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {tbl.capacity} kishilik
                </span>
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">{bDict.noTables || "Bo'sh stollar topilmadi"}</p>
        )}
      </div>

      <Modal isOpen={showBookingModal} onClose={() => setShowBookingModal(false)} maxWidth="max-w-xl">
        <div className="flex flex-col p-2">
          <div className="flex items-center gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
            <Utensils className="h-6 w-6 text-primary-600 dark:text-primary-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">{bDict.title || "Stol bron qilish"}</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {restaurant.name} · {selectedTable?.name?.startsWith("Stol") ? selectedTable.name.replace("Stol", bDict.table || "Stol") : selectedTable?.name}
              </p>
            </div>
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleProcessPayment} className="mt-4 space-y-5">
            {/* Date and Time */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {bDict.dateLabel || "Sana"}
                </label>
                <DatePicker
                  value={date}
                  onChange={setDate}
                  min={new Date().toISOString().split("T")[0]}
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {bDict.timeLabel || "Vaqt"}
                  </label>
                  <div className="relative mt-1">
                    <Clock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="time"
                      value={slotTime}
                      onChange={(e) => setSlotTime(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {bDict.guestsLabel || "Mehmonlar"}
                  </label>
                  <select
                    value={guests}
                    onChange={(e) => setGuests(Number(e.target.value))}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                      <option key={n} value={n}>
                        {n} ta
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Guest Info */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {bDict.nameLabel || "Ism va familiya"}
                </label>
                <input
                  type="text"
                  placeholder="Ali Valiyev"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {bDict.phoneLabel || "Telefon raqam"}
                </label>
                <input
                  type="tel"
                  placeholder="+998 90 123 45 67"
                  value={guestPhone}
                  onChange={(e) => setGuestPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  required
                />
              </div>
            </div>

            {/* Payment Info inside Modal — checkout formasi (mehmonxona bron
                oqimi) bilan BIR XIL, qayta ishlatiladigan komponent. Karta
                turi (uzcard/humo/visa/mastercard) faqat FEE stavkasini
                belgilaydi — hammasi Uzum Checkout orqali (hosted/redirect
                sahifa). */}
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60 mt-2 border border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-primary-600" />
                {bDict.modalTitle || "To'lovni amalga oshirish"}
              </h4>

              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">{bDict.paymentType || "To'lov usuli"}</label>
              <PaymentSelector
                defaultValue={paymentMethod}
                name="paymentMethod"
                onChange={setPaymentMethod}
              />

              {/* Karta tanlansa — xom karta raqami/CVV BU YERDA umuman
                  so'ralmaydi. Haqiqiy to'lov keyingi qadamda (bron detail
                  sahifasida) to'lov provayderining HAQIQIY xavfsiz
                  sahifasiga redirect orqali amalga oshiriladi. */}
              {paymentMethod !== "cash" && (
                <div className="mt-3 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
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
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />{bDict.cashNote || "Stol band qilinadi. To'lov restoranga yetib kelganingizda amalga oshiriladi."}
                </div>
              )}
            </div>

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

            {!isLoggedIn ? (
              <Link href={`/${locale}/login?next=/${locale}/restaurants/${restaurant.id}`} className="w-full block">
                <Button
                  type="button"
                  className="w-full bg-slate-900 font-extrabold text-white hover:bg-slate-800 py-3 shadow-md dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                >
                  {bDict.loginToBook || "Bron qilish uchun tizimga kiring"}
                </Button>
              </Link>
            ) : (
              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 font-extrabold text-white hover:bg-primary-700 py-3 shadow-md"
              >
                {loading
                  ? paymentMethod === "cash"
                    ? (bDict.processingCash || "Bron tasdiqlanmoqda...")
                    : (bDict.processingPayment || "To'lov sahifasiga o'tilmoqda...")
                  : paymentMethod === "cash"
                  ? (bDict.confirmCash || "Bronni tasdiqlash (Naqd)")
                  : `${totalAmount > 0 ? formatSum(totalAmount) : (bDict.freeBooking || "Bepul (Stol band etish)")} - ${bDict.confirmPayment || "To'lovni tasdiqlash"}`}
              </Button>
            )}
          </form>
        </div>
      </Modal>
    </>
  );
}
