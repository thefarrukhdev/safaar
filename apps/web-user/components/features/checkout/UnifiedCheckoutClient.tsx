"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { checkoutTranslations } from "./i18n";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ShieldCheck, CheckCircle2 } from "lucide-react";
import { createRestaurantBookingAction } from "@/lib/services/booking/actions";

export function UnifiedCheckoutClient() {
  const searchParams = useSearchParams();
  const params = useParams<{ lang?: string }>();
  const router = useRouter();
  const locale = params?.lang || "uz";
  const t = checkoutTranslations[locale as keyof typeof checkoutTranslations] || checkoutTranslations.uz;

  const type = searchParams.get("type") || "restaurant";
  const entityId = searchParams.get("entityId") || "";
  const subEntityId = searchParams.get("subEntityId") || "";
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  const slotTime = searchParams.get("slotTime") || "";
  const guests = Number(searchParams.get("guests")) || 2;

  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("+998");
  const [guestEmail, setGuestEmail] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"card" | "cash">(type === "restaurant" ? "cash" : "card");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpire, setCardExpire] = useState("");
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);

  useEffect(() => {
    if (type === "restaurant") {
      setPaymentMethod("cash");
    }
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setErrorMsg(t.acceptTermsError);
      return;
    }
    setErrorMsg(null);
    setLoading(true);

    try {
      if (type === "restaurant") {
        const res = await createRestaurantBookingAction({
          restaurantId: entityId,
          tableId: subEntityId,
          date: checkIn,
          slotTime,
          guests,
          totalPrice: 0, // Should be fetched properly in the future
          guestName,
          guestPhone,
          guestEmail,
          paymentMethod: paymentMethod === "card" ? "uzcard" : "cash",
          agreeTerms,
        });

        if (res.ok && res.bookingId) {
          setSuccessBookingId(res.bookingId);
        } else {
          setErrorMsg(res.error || t.error);
        }
      } else {
        // Fallback or implementation for hotel/vehicle (future)
        setErrorMsg("Only restaurant booking is fully implemented in this demo.");
      }
    } catch (err) {
      setErrorMsg(t.error);
    } finally {
      setLoading(false);
    }
  };

  if (successBookingId) {
    return (
      <div className="mx-auto max-w-lg mt-10 rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-center shadow-md dark:border-emerald-800 dark:bg-emerald-950/40">
        <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
        <h3 className="mt-3 text-xl font-extrabold text-emerald-900 dark:text-emerald-200">{t.successTitle}</h3>
        <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
          {t.bookingId} <span className="font-mono font-bold">{successBookingId}</span>
        </p>
        <div className="mt-6">
          <Link href={`/${locale}`}>
            <Button variant="secondary" className="border-emerald-300 text-emerald-800 hover:bg-emerald-100">
              {t.newBooking}
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-5xl py-10 px-4">
      <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-8">{t.title}</h1>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
        {/* Left Column - Form */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {errorMsg && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t.guestInfo}</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.nameLabel}
                  </label>
                  <input
                    type="text"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t.phoneLabel}
                  </label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    required
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                  />
                </div>
                {type !== "restaurant" && (
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      {t.emailLabel}
                    </label>
                    <input
                      type="email"
                      value={guestEmail}
                      onChange={(e) => setGuestEmail(e.target.value)}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t.paymentMethod}</h2>
              
              {type === "restaurant" ? (
                <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-300">
                  <ShieldCheck className="h-5 w-5 shrink-0 text-amber-600" />
                  <p>{t.cashNote}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="radio" 
                        name="payment" 
                        value="card" 
                        checked={paymentMethod === "card"} 
                        onChange={() => setPaymentMethod("card")} 
                        className="text-primary-600 focus:ring-primary-500" 
                      />
                      {t.card}
                    </label>
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                      <input 
                        type="radio" 
                        name="payment" 
                        value="cash" 
                        checked={paymentMethod === "cash"} 
                        onChange={() => setPaymentMethod("cash")} 
                        className="text-primary-600 focus:ring-primary-500" 
                      />
                      {t.cash}
                    </label>
                  </div>
                  {paymentMethod === "card" && (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t.cardNumber}
                        </label>
                        <input
                          type="text"
                          value={cardNumber}
                          onChange={(e) => setCardNumber(e.target.value)}
                          placeholder="0000 0000 0000 0000"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                          {t.cardExpire}
                        </label>
                        <input
                          type="text"
                          value={cardExpire}
                          onChange={(e) => setCardExpire(e.target.value)}
                          placeholder="MM/YY"
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800/50 dark:text-white"
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  required
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-slate-600 dark:text-slate-400">
                  {t.termsAgree}{" "}
                  <Link
                    href={`/${locale}/terms`}
                    target="_blank"
                    className="font-semibold text-primary-600 hover:underline"
                  >
                    {t.termsLink}
                  </Link>.
                </span>
              </label>
            </section>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary-600 font-extrabold text-white hover:bg-primary-700 py-4 text-base shadow-md"
            >
              {loading ? t.processing : t.submit}
            </Button>
          </form>
        </div>

        {/* Right Column - Order Summary */}
        <div className="h-fit rounded-xl border border-slate-200 bg-slate-50 p-6 dark:border-slate-800 dark:bg-slate-900/50">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4">{t.orderSummary}</h2>
          <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300">
            <div className="flex justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <span className="font-semibold">ID:</span>
              <span className="font-mono">{entityId}</span>
            </div>
            
            <div className="flex justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
              <span className="font-semibold">{t.checkIn}:</span>
              <span>{checkIn}</span>
            </div>

            {type === "restaurant" && slotTime && (
              <div className="flex justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <span className="font-semibold">{t.time}:</span>
                <span>{slotTime}</span>
              </div>
            )}

            {type !== "restaurant" && checkOut && (
              <div className="flex justify-between border-b border-slate-200 pb-3 dark:border-slate-800">
                <span className="font-semibold">{t.checkOut}:</span>
                <span>{checkOut}</span>
              </div>
            )}

            <div className="flex justify-between pb-1">
              <span className="font-semibold">{t.guests}:</span>
              <span>{guests}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
