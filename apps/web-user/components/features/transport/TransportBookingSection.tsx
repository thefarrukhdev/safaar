"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Calendar,
  CheckCircle2,
  Car,
  CreditCard,
  Banknote,
  X,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { formatSum } from "@/lib/money";
import type { TransportDetailView } from "@safaar/api-client";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { createVehicleBookingAction } from "@/lib/services/booking/actions";

function daysBetween(checkIn: string, checkOut: string): number {
  const start = Date.parse(checkIn);
  const end = Date.parse(checkOut);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / (1000 * 60 * 60 * 24));
}

import type { CatalogDict } from "@/i18n/dictionaries";

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

  const todayDate = new Date();
  const today = todayDate.toISOString().split("T")[0];
  const [checkIn, setCheckIn] = useState<string>(today);
  const [checkOut, setCheckOut] = useState<string>(() => {
    const tomorrow = new Date(todayDate);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split("T")[0];
  });
  const [guestName, setGuestName] = useState<string>("");
  const [guestPhone, setGuestPhone] = useState<string>("");
  const [guestEmail, setGuestEmail] = useState<string>("");
  const [agreeTerms, setAgreeTerms] = useState<boolean>(false);
  const bDict = (dict as any).booking || {};

  const [showPaymentModal, setShowPaymentModal] = useState<boolean>(false);
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">("card");
  const [cardNumber, setCardNumber] = useState<string>("");
  const [cardExpire, setCardExpire] = useState<string>("");

  const [loading, setLoading] = useState<boolean>(false);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const days = useMemo(() => daysBetween(checkIn, checkOut), [checkIn, checkOut]);
  const totalAmount = days > 0 ? days * transport.pricePerDaySum : 0;

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

  const handleOpenModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (days <= 0) {
      setErrorMsg(bDict.dateOrderError || "Qaytarish sanasi olib ketish sanasidan keyin bo'lishi kerak");
      return;
    }
    if (!guestName.trim() || !guestPhone.trim()) {
      setErrorMsg(bDict.namePhoneRequired || "Iltimos, ismingiz va telefon raqamingizni kiriting");
      return;
    }
    setErrorMsg(null);
    setShowPaymentModal(true);
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (paymentMethod === "card") {
      const rawCard = cardNumber.replace(/\s/g, "");
      if (rawCard.length < 16) {
        setErrorMsg(bDict.cardDigitsError || "Karta raqamini to'liq kiriting (16 xona)");
        return;
      }
      if (cardExpire.length < 5) {
        setErrorMsg(bDict.cardExpireError || "Karta amal qilish muddatini kiriting (MM/YY)");
        return;
      }
    }
    if (!agreeTerms) {
      setErrorMsg(bDict.termsRequired || "Davom etish uchun Ommaviy Oferta shartlariga rozilik bering");
      return;
    }

    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await createVehicleBookingAction({
        vehicleId: transport.id,
        checkIn,
        checkOut,
        guestName,
        guestPhone,
        guestEmail,
        paymentMethod: paymentMethod === "card" ? "uzcard" : "cash",
      });

      if (!res.ok) {
        throw new Error(res.error || bDict.error || "Xatolik yuz berdi");
      }

      setSuccessBookingId(res.bookingId as string);
      setShowPaymentModal(false);
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
        <h3 className="mt-3 text-xl font-extrabold text-emerald-900 dark:text-emerald-200">{bDict.successTitle || "To'lov bajarildi va mashina band qilindi!"}</h3>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">{bDict.bookingId || "Bron ID:"}<span className="font-mono font-bold">{successBookingId}</span>
        </p>
        <div className="mt-4 rounded-xl bg-emerald-100/60 p-3 text-left text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
          <p><strong>{bDict.transportLabel || "Transport:"}</strong> {transport.name}</p>
          <p><strong>{bDict.periodLabel || "Muddat:"}</strong> {checkIn} — {checkOut} ({days} kun)</p>
          <p><strong>{bDict.clientLabel || "Mijoz:"}</strong> {guestName} ({guestPhone})</p>
          <p><strong>{bDict.paymentMethodLabel || "To'lov usuli:"}</strong> {paymentMethod === "card" ? "Karta orqali" : "Naqd pul"}</p>
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
          <Car className="h-5 w-5 text-primary-600 dark:text-primary-400" />{bDict.title || "Mashinani band qilish"}</h2>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {formatSum(transport.pricePerDaySum)} / kuniga
        </p>

        {errorMsg && !showPaymentModal && (
          <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleOpenModal} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
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
            <div className="flex items-center justify-between rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs dark:bg-slate-800/60">
              <span className="text-slate-500 dark:text-slate-400">{((dict as any).booking?.daysCount || "{days} kun").replace("{days}", days.toString())}</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatSum(totalAmount)}
              </span>
            </div>
          )}

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
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                {bDict.emailLabel || "Email"} {!isLoggedIn && <span className="text-red-500">*</span>}
              </label>
              <input
                type="email"
                placeholder={bDict.emailPlaceholder || "ali@example.com"}
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                required={!isLoggedIn}
              />
            </div>
          </div>

          <Button
            type="submit"
            className="w-full bg-primary-600 font-extrabold text-white hover:bg-primary-700 py-3"
          >{bDict.title || "Mashinani band qilish"}</Button>
        </form>
      </div>

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
              {transport.name} · {checkIn} — {checkOut}
            </p>

            {errorMsg && (
              <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
                {errorMsg}
              </div>
            )}

            <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs dark:bg-slate-800/60">
              <div className="flex justify-between py-1">
                <span className="text-slate-500 dark:text-slate-400">{bDict.periodLabel || "Muddat:"}</span>
                <span className="font-semibold text-slate-900 dark:text-white">{((dict as any).booking?.daysCount || "{days} kun").replace("{days}", days.toString())}</span>
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
                  {formatSum(totalAmount)}
                </span>
              </div>
            </div>

            <form onSubmit={handleProcessPayment} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">{bDict.paymentType || "To'lov usuli"}</label>
                <div className="mt-1.5 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod("card")}
                    className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all ${
                      paymentMethod === "card"
                        ? "border-primary-600 bg-primary-50 text-primary-900 ring-2 ring-primary-500 dark:border-primary-500 dark:bg-primary-950/50 dark:text-white"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <CreditCard className="h-4 w-4 shrink-0 text-primary-600 dark:text-primary-400" />{bDict.bankCard || "Bank kartasi"}</button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center gap-2 rounded-xl border p-3 text-xs font-semibold transition-all ${
                      paymentMethod === "cash"
                        ? "border-primary-600 bg-primary-50 text-primary-900 ring-2 ring-primary-500 dark:border-primary-500 dark:bg-primary-950/50 dark:text-white"
                        : "border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Banknote className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />{bDict.cashPayment || "Naqd (Joyida)"}</button>
                </div>
              </div>

              {paymentMethod === "card" && (
                <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-800/40">
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
                    <Lock className="h-3 w-3 text-emerald-500" />{bDict.securePayment || "256-bit xavfsiz to'lov shifrlanishi"}</div>
                </div>
              )}

              {paymentMethod === "cash" && (
                <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  <ShieldCheck className="h-4 w-4 shrink-0 text-amber-600" />{bDict.cashNote || "Mashina band qilinadi. To'lov mashinani olganingizda amalga oshiriladi."}</div>
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
                  >{bDict.termsLink || "Ommaviy Oferta"}</Link>{" "}
                  shartlariga roziman.
                </span>
              </label>

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-600 font-extrabold text-white hover:bg-primary-700 py-3 shadow-md"
              >
                {loading
                  ? (bDict.bookingSubmitting || "To'lov amalga oshirilmoqda...")
                  : paymentMethod === "card"
                  ? formatSum(totalAmount)
                  : "Bronni tasdiqlash (Naqd)"}
              </Button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
