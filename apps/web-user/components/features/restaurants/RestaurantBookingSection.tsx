"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Calendar,
  Clock,
  CheckCircle2,
  Utensils,
  CreditCard,
  Banknote,
  X,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { formatSum } from "@/lib/money";
import type { RestaurantDetailView } from "@safaar/api-client";
import { Button } from "@/components/ui/Button";
import { createRestaurantBookingAction } from "@/lib/services/booking/actions";
import { DatePicker } from "@/components/ui/DatePicker";
import { Modal } from "@/components/ui/Modal";
import type { CatalogDict } from "@/i18n/dictionaries";

export function RestaurantBookingSection({
  dict,
  restaurant,
}: {
  restaurant: RestaurantDetailView;
  dict: CatalogDict["restaurants"];
}) {
  const params = useParams<{ lang?: string }>();
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
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">("card");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardExpire, setCardExpire] = useState<string>("");
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);

  const [loading, setLoading] = useState<boolean>(false);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const bDict = (dict as any).booking || {};
  const selectedTable = restaurant.tables.find((t) => t.id === selectedTableId);
  const totalAmount = selectedTable?.basePriceSum ?? 0;

  const handleCardNumberChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 16);
    const formatted = digits.replace(/(.{4})/g, "$1 ").trim();
    setCardNumber(formatted);
  };

  const handleCardExpireChange = (val: string) => {
    const digits = val.replace(/\D/g, "").slice(0, 4);
    if (digits.length >= 3) {
      setCardExpire(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    } else {
      setCardExpire(digits);
    }
  };

  const handleTableClick = (tblId: string) => {
    setSelectedTableId(tblId);
    setGuests(restaurant.tables.find(t => t.id === tblId)?.capacity || 2);
    setShowBookingModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setErrorMsg(bDict.acceptTermsError || "Ommaviy oferta shartlariga rozi bo'lishingiz kerak.");
      return;
    }
    if (paymentMethod === "card" && (cardNumber.length < 19 || cardExpire.length < 5)) {
      setErrorMsg(bDict.cardFormatError || "Karta ma'lumotlarini to'liq kiriting");
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await createRestaurantBookingAction({
        restaurantId: restaurant.id,
        tableId: selectedTableId || restaurant.id,
        date: date,
        slotTime: slotTime,
        guests: guests,
        totalPrice: totalAmount,
        guestName,
        guestPhone,
        guestEmail,
        paymentMethod: paymentMethod === "card" ? "uzcard" : "cash",
        agreeTerms,
      });

      if (res.ok && res.bookingId) {
        setSuccessBookingId(res.bookingId);
        setShowBookingModal(false);
      } else {
        setErrorMsg(res.error || bDict.error || "Xatolik yuz berdi");
      }
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
        <h3 className="mt-3 text-xl font-extrabold text-emerald-900 dark:text-emerald-200">{bDict.successTitle || "To'lov bajarildi va stol band qilindi!"}</h3>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">{bDict.bookingId || "Bron ID:"}<span className="font-mono font-bold">{successBookingId}</span>
        </p>
        <div className="mt-4 rounded-xl bg-emerald-100/60 p-3 text-left text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          <p><strong>{bDict.restaurantLabel || "Restoran:"}</strong> {restaurant.name}</p>
          <p><strong>{bDict.tableLabel || "Stol:"}</strong> {selectedTable?.name?.startsWith("Stol") ? selectedTable.name.replace("Stol", bDict.table || "Stol") : selectedTable?.name}</p>
          <p><strong>{bDict.dateTimeLabel || "Sana va vaqt:"}</strong> {date} ({slotTime})</p>
          <p><strong>{bDict.clientLabel || "Mijoz:"}</strong> {guestName} ({guestPhone})</p>
          <p><strong>{bDict.paymentMethodLabel || "To'lov usuli:"}</strong> {paymentMethod === "card" ? (bDict.cardPayment || "Karta orqali") : (bDict.cashPayment || "Naqd pul")}</p>
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

            {/* Payment Info inside Modal */}
            <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-800/60 mt-2 border border-slate-100 dark:border-slate-800">
              <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 mb-3">
                <CreditCard className="w-4 h-4 text-primary-600" /> 
                {bDict.modalTitle || "To'lovni amalga oshirish"}
              </h4>
              
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">{bDict.paymentType || "To'lov usuli"}</label>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("card")}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all ${
                    paymentMethod === "card"
                      ? "border-primary-600 bg-primary-50 text-primary-900 ring-2 ring-primary-500 dark:border-primary-500 dark:bg-primary-950/50 dark:text-white"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <CreditCard className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />{bDict.bankCard || "Bank kartasi"}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all ${
                    paymentMethod === "cash"
                      ? "border-primary-600 bg-primary-50 text-primary-900 ring-2 ring-primary-500 dark:border-primary-500 dark:bg-primary-950/50 dark:text-white"
                      : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  }`}
                >
                  <Banknote className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />{bDict.cashOnSite || "Naqd (Joyida)"}
                </button>
              </div>

              {paymentMethod === "card" && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3.5 dark:border-slate-700 dark:bg-slate-900">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">{bDict.cardNumber || "Karta raqami (Uzcard / Humo / Visa)"}</label>
                    <input
                      type="text"
                      placeholder="8600 0000 0000 0000"
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => handleCardNumberChange(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono tracking-wider text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300">{bDict.cardExpire || "Amal qilish muddati (MM/YY)"}</label>
                    <input
                      type="text"
                      placeholder="12/28"
                      maxLength={5}
                      value={cardExpire}
                      onChange={(e) => handleCardExpireChange(e.target.value)}
                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      required
                    />
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                    <Lock className="h-3 w-3 text-emerald-500" />{bDict.securePayment || "256-bit xavfsiz to'lov shifrlanishi"}
                  </div>
                </div>
              )}

              {paymentMethod === "cash" && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
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

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 font-extrabold text-white hover:bg-primary-700 py-3 shadow-md"
            >
              {loading
                ? (bDict.processingPayment || "To'lov amalga oshirilmoqda...")
                : paymentMethod === "card"
                ? `${totalAmount > 0 ? formatSum(totalAmount) : (bDict.freeBooking || "Bepul (Stol band etish)")} - ${bDict.confirmPayment || "To'lovni tasdiqlash"}`
                : (bDict.confirmCash || "Bronni tasdiqlash (Naqd)")}
            </Button>
          </form>
        </div>
      </Modal>
    </>
  );
}
