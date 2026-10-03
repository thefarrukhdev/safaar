"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import Link from "next/link";
import { ShieldCheck, CheckCircle2, AlertCircle, Info, CalendarClock } from "lucide-react";
import { 
  createRestaurantBookingAction, 
  createVehicleBookingAction,
  createBookingAction,
  createBusBookingAction
} from "@/lib/services/booking/actions";
import { PaymentSelector, type PaymentMethodId } from "./PaymentSelector";
import { UzumCheckoutFrame } from "@/app/[lang]/(main)/booking/[id]/_components/UzumCheckoutFrame";
import { previewPayment } from "@/lib/services/payments/actions";
import type { CheckoutDict } from "@/i18n/dictionaries";

export function UnifiedCheckoutClient({ dict }: { dict: CheckoutDict }) {
  const searchParams = useSearchParams();
  const params = useParams<{ lang?: string }>();
  const router = useRouter();
  const locale = params?.lang || "uz";

  const type = searchParams.get("type") || "restaurant";
  const entityId = searchParams.get("entityId") || "";
  const subEntityId = searchParams.get("subEntityId") || "";
  const checkIn = searchParams.get("checkIn") || "";
  const checkOut = searchParams.get("checkOut") || "";
  const slotTime = searchParams.get("slotTime") || "";
  const guests = Number(searchParams.get("guests")) || 2;
  const totalPrice = Number(searchParams.get("totalPrice")) || 0;

  const isNoCardType = type === "restaurant";

  const [guestFirstName, setGuestFirstName] = useState("");
  const [guestLastName, setGuestLastName] = useState("");
  const [guestPhone, setGuestPhone] = useState("+998");
  const [guestEmail, setGuestEmail] = useState("");
  const [specialRequests, setSpecialRequests] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>(isNoCardType ? "cash" : "uzcard");
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successBookingId, setSuccessBookingId] = useState<string | null>(null);
  const [guestToken, setGuestToken] = useState<string | undefined>(undefined);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);

  useEffect(() => {
    if (type === "restaurant") {
      setPaymentMethod("cash");
    }
  }, [type]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreeTerms) {
      setErrorMsg(dict.errors.TERMS_NOT_ACCEPTED);
      return;
    }
    setErrorMsg(null);
    setLoading(true);

    try {
      let bookingId = "";
      let guestAccessToken = "";
      let isPaymentPending = false;
      let finalPaymentMethod = paymentMethod;

      if (type === "restaurant") {
        const res = await createRestaurantBookingAction({
          restaurantId: entityId,
          tableId: subEntityId,
          date: checkIn,
          slotTime,
          guests,
          totalPrice,
          guestName: `${guestFirstName} ${guestLastName}`.trim(),
          guestPhone,
          guestEmail,
          paymentMethod,
          agreeTerms,
        });
        if (!res.ok) throw new Error(res.error || dict.error);
        bookingId = res.bookingId!;
        guestAccessToken = res.guestAccessToken || "";
      } else if (type === "transport") {
        const res = await createVehicleBookingAction({
          vehicleId: entityId,
          checkIn,
          checkOut,
          guestName: `${guestFirstName} ${guestLastName}`.trim(),
          guestPhone,
          guestEmail,
          paymentMethod,
        });
        if (!res.ok) throw new Error(res.error || dict.error);
        bookingId = res.bookingId!;
        guestAccessToken = res.guestAccessToken || "";
      } else if (type === "hotel") {
        const formData = new FormData();
        formData.append("hotelId", entityId);
        formData.append("roomId", subEntityId);
        formData.append("checkIn", checkIn);
        formData.append("checkOut", checkOut);
        formData.append("guests", guests.toString());
        formData.append("paymentMethod", paymentMethod);
        formData.append("firstName", guestFirstName);
        formData.append("lastName", guestLastName);
        formData.append("phone", guestPhone);
        if (guestEmail) formData.append("email", guestEmail);
        if (specialRequests) formData.append("specialRequests", specialRequests);
        formData.append("agreeTerms", "on");
        formData.append("locale", locale);
        
        const res = await createBookingAction({}, formData);
        if (res.error) throw new Error(res.error);
        
        // As createBookingAction redirects, we shouldn't hit this normally unless it errors,
        // but if it doesn't redirect we can just redirect manually:
        router.push(`/${locale}/booking`);
        return;
      } else {
        throw new Error("Tizimda noma'lum buyurtma turi.");
      }

      if (paymentMethod !== "cash") {
        const paymentResult = await previewPayment(bookingId, paymentMethod, guestAccessToken);
        if (paymentResult.error || !paymentResult.payment?.paymentUrl) {
          setErrorMsg(paymentResult.error || "Payment session error");
        } else {
          setSuccessBookingId(bookingId);
          setGuestToken(guestAccessToken);
          setPaymentUrl(paymentResult.payment.paymentUrl);
        }
      } else {
        setSuccessBookingId(bookingId);
      }
    } catch (err: any) {
      if (err?.message === "NEXT_REDIRECT" || err?.digest?.startsWith("NEXT_REDIRECT")) {
        throw err;
      }
      const errKey = err.message as keyof typeof dict.errors;
      const localizedError = dict.errors?.[errKey] || err.message || dict.error;
      setErrorMsg(localizedError);
    } finally {
      setLoading(false);
    }
  };

  if (successBookingId && !paymentUrl) {
    return (
      <div className="mx-auto max-w-lg mt-10 mb-20 rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-6">
          <CheckCircle2 className="h-10 w-10 text-emerald-600" />
        </div>
        <h3 className="text-2xl font-extrabold text-emerald-900 mb-2">{dict.summary} - Muvaffaqiyatli!</h3>
        <p className="text-emerald-700 mb-8 text-lg">
          Bron ID: <span className="font-mono font-bold bg-white px-2 py-1 rounded border border-emerald-200">{successBookingId}</span>
        </p>
        <Link href={`/${locale}`}>
          <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm py-6 text-lg rounded-xl">
            Bosh sahifaga qaytish
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl py-8 px-4 md:py-12 mb-10">
      <h1 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-8 md:mb-12">{dict.title}</h1>

      <div className="flex flex-col lg:flex-row gap-8 xl:gap-12">
        {/* Left Column - Form */}
        <div className="flex-1 lg:w-2/3">
          {errorMsg && (
            <div className="mb-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-800 shadow-sm">
              <AlertCircle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8 lg:space-y-10">
            {/* Guest Info Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm">1</span>
                  {dict.guestDetails}
                </h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">{dict.firstName}</label>
                  <input
                    type="text"
                    value={guestFirstName}
                    onChange={(e) => setGuestFirstName(e.target.value)}
                    required
                    placeholder="Eldor"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 transition-colors focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">{dict.lastName}</label>
                  <input
                    type="text"
                    value={guestLastName}
                    onChange={(e) => setGuestLastName(e.target.value)}
                    required
                    placeholder="Mustafoyev"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 transition-colors focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">{dict.phone}</label>
                  <input
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => setGuestPhone(e.target.value)}
                    required
                    placeholder="+998 90 123 45 67"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 transition-colors focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-semibold text-slate-700">{dict.email} (ixtiyoriy)</label>
                  <input
                    type="email"
                    value={guestEmail}
                    onChange={(e) => setGuestEmail(e.target.value)}
                    placeholder="eldor@example.com"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 transition-colors focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300"
                  />
                </div>
                
                {type === "hotel" && (
                  <div className="md:col-span-2 space-y-1.5 mt-2">
                    <label className="block text-sm font-semibold text-slate-700">{dict.specialRequests}</label>
                    <textarea
                      value={specialRequests}
                      onChange={(e) => setSpecialRequests(e.target.value)}
                      placeholder={dict.specialRequestsPlaceholder}
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-900 transition-colors focus:bg-white focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-500/10 hover:border-slate-300 resize-none"
                    />
                  </div>
                )}
              </div>
            </section>

            {/* Payment Method Section */}
            <section className="rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm">
              <div className="mb-6 border-b border-slate-100 pb-4">
                <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 text-sm">2</span>
                  {dict.paymentMethod}
                </h2>
              </div>
              
              {isNoCardType ? (
                <div className="flex items-start gap-4 rounded-xl border-2 border-amber-200 bg-amber-50 p-5 text-amber-900">
                  <div className="mt-0.5 rounded-full bg-amber-200/50 p-2 text-amber-600">
                    <ShieldCheck className="h-6 w-6" />
                  </div>
                  <div>
                    <h4 className="font-bold mb-1">Joyida to'lash</h4>
                    <p className="text-sm text-amber-800 leading-relaxed">
                      Stol band qilinadi. To'lov restoranga yetib kelganingizda amalga oshiriladi.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  <PaymentSelector 
                    defaultValue={paymentMethod} 
                    onChange={setPaymentMethod} 
                    dict={dict.paymentMethods}
                  />
                  {paymentMethod !== "cash" && (
                    <div className="flex items-start gap-3 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                      <Info className="h-5 w-5 shrink-0 text-slate-400 mt-0.5" />
                      <p>{dict.secureCardNotice}</p>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* Terms and Submit */}
            <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6 md:p-8 shadow-sm">
              <label className="flex items-start gap-4 mb-8 cursor-pointer group">
                <div className="flex h-6 items-center">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(e) => setAgreeTerms(e.target.checked)}
                    required
                    className="h-5 w-5 rounded-md border-slate-300 text-blue-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 focus:ring-offset-0 transition-colors"
                  />
                </div>
                <span className="text-slate-700 text-base leading-snug pt-0.5 select-none">
                  {dict.agreeTermsPrefix}{" "}
                  <Link
                    href={`/${locale}/terms`}
                    target="_blank"
                    className="font-bold text-blue-600 hover:text-blue-700 hover:underline decoration-2 underline-offset-2"
                  >
                    {dict.termsLink}
                  </Link>
                  {dict.agreeTermsSuffix}
                </span>
              </label>

              <Button
                type="submit"
                disabled={loading || !agreeTerms}
                className="w-full bg-blue-600 font-extrabold text-white hover:bg-blue-700 py-7 text-lg shadow-lg hover:shadow-xl transition-all disabled:opacity-70 disabled:hover:shadow-none rounded-xl"
              >
                {loading ? "Jarayonda..." : dict.confirm}
              </Button>
            </section>
          </form>
        </div>

        {/* Right Column - Order Summary Sidebar */}
        <div className="lg:w-1/3">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6 pb-4 border-b border-slate-100 flex items-center gap-2">
              <CalendarClock className="h-5 w-5 text-slate-500" />
              {dict.summary}
            </h2>
            
            <div className="space-y-4 text-sm text-slate-700">
              {checkIn && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className="text-slate-500 font-medium">{dict.checkIn}</span>
                  <span className="font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">{checkIn}</span>
                </div>
              )}

              {type === "restaurant" && slotTime && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className="text-slate-500 font-medium">Vaqt</span>
                  <span className="font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">{slotTime}</span>
                </div>
              )}

              {type !== "restaurant" && checkOut && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className="text-slate-500 font-medium">{dict.checkOut}</span>
                  <span className="font-semibold text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md">{checkOut}</span>
                </div>
              )}

              {type !== "transport" && guests > 0 && (
                <div className="flex justify-between items-center py-2 border-b border-slate-100 last:border-0">
                  <span className="text-slate-500 font-medium">{dict.guests}</span>
                  <span className="font-semibold text-slate-900">{guests} nafar</span>
                </div>
              )}
            </div>

            {totalPrice > 0 && (
              <div className="mt-8 pt-6 border-t border-slate-200">
                <div className="flex justify-between items-end">
                  <span className="text-base font-bold text-slate-900">{dict.total}</span>
                  <div className="text-right">
                    <span className="text-2xl font-extrabold text-slate-900">{totalPrice.toLocaleString()}</span>
                    <span className="text-sm font-semibold text-slate-500 ml-1">UZS</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {paymentUrl && successBookingId && (
        <UzumCheckoutFrame
          checkoutUrl={paymentUrl}
          bookingId={successBookingId}
          guestToken={guestToken}
          onPaid={() => {
            setPaymentUrl(null);
            router.refresh();
          }}
          onClose={() => setPaymentUrl(null)}
        />
      )}
    </div>
  );
}
