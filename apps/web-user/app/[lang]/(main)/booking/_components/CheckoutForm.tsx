"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { CheckoutDict } from "@/i18n/dictionaries";
import { createBookingAction, validatePromoAction, type CheckoutState } from "@/lib/booking/actions";
import { formatSum } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { PaymentSelector, type PaymentMethodId } from "@/components/features/checkout/PaymentSelector";
import { trackBookingStarted } from "@/lib/services/analytics/tracker";
import { CheckoutMobileCtaBar } from "./CheckoutMobileCtaBar";

function nightsBetween(checkIn: string, checkOut: string): number {
  const start = Date.parse(checkIn);
  const end = Date.parse(checkOut);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  return Math.ceil((end - start) / 86_400_000);
}

export function CheckoutForm({
  locale,
  dict,
  hotelId,
  hotelName,
  room,
  defaults,
  isGuest = false,
}: {
  locale: Locale;
  dict: CheckoutDict;
  hotelId: string;
  hotelName: string;
  room: { id: string; name: string; priceSum: number; capacity: number };
  defaults: { checkIn: string; checkOut: string; guests: number };
  isGuest?: boolean;
}) {
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [guests, setGuests] = useState(Math.min(room.capacity, Math.max(1, defaults.guests)));
  const [promoCode, setPromoCode] = useState("");
  const [promoDiscount, setPromoDiscount] = useState<{ type: string; value: number } | null>(null);
  const [promoLoading, setPromoLoading] = useState(false);
  const [promoError, setPromoError] = useState("");

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("uzcard");
  const [state, action, pending] = useActionState<CheckoutState, FormData>(
    createBookingAction,
    {},
  );

  const nights = nightsBetween(checkIn, checkOut);
  let total = room.priceSum * Math.max(nights, 0);
  let discountAmount = 0;
  if (promoDiscount && total > 0) {
    if (promoDiscount.type.startsWith("percent")) {
      discountAmount = (total * promoDiscount.value) / 100;
    } else {
      discountAmount = promoDiscount.value;
    }
    if (discountAmount > total) discountAmount = total;
    total -= discountAmount;
  }

  const getErrorMessage = (error: string) => {
    if (error === "ERROR") return dict.error;
    const errorsDict = dict.errors as Record<string, string> | undefined;
    return errorsDict?.[error] ?? error;
  };

  
  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setPromoLoading(true);
    setPromoError("");
    const res = await validatePromoAction(promoCode.trim());
    if (res.success && res.data) {
      setPromoDiscount({ type: res.data.discount_type, value: Number(res.data.discount_value) });
    } else {
      setPromoDiscount(null);
      setPromoError(res.error || "Promo kod noto'g'ri yoki muddati tugagan");
    }
    setPromoLoading(false);
  };

  const handleSubmitForm = (formData: FormData) => {
    trackBookingStarted({
      hotelId,
      roomId: room.id,
      totalSum: total,
    });
    action(formData);
  };

  return (
    <>
    <form
      action={handleSubmitForm}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="roomId" value={room.id} />

      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-xl border border-slate-900/[0.08] bg-card p-5">
          <h2 className="text-lg font-semibold">{dict.guestDetails}</h2>
          
          {isGuest ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{dict.firstName}</span>
                <Input
                  name="firstName"
                  autoComplete="given-name"
                  required
                  placeholder={dict.firstName}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{dict.lastName}</span>
                <Input
                  name="lastName"
                  autoComplete="family-name"
                  required
                  placeholder={dict.lastName}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{dict.email}</span>
                <Input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="example@mail.com"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{dict.phone}</span>
                <Input
                  type="tel"
                  name="phone"
                  autoComplete="tel"
                  required
                  placeholder="+998 90 123 45 67"
                />
              </label>
            </div>
          ) : (
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{dict.fullName}</span>
              <Input
                name="fullName"
                autoComplete="name"
                placeholder={dict.fullNamePlaceholder}
              />
            </label>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <DatePicker
                locale={locale}
                label={dict.checkIn}
                value={checkIn}
                onChange={setCheckIn}
                min={new Date().toISOString().split("T")[0]}
              />
              <input type="hidden" name="checkIn" value={checkIn} />
            </div>
            <div className="flex flex-col gap-1">
              <DatePicker
                locale={locale}
                label={dict.checkOut}
                value={checkOut}
                onChange={setCheckOut}
                min={checkIn || new Date().toISOString().split("T")[0]}
              />
              <input type="hidden" name="checkOut" value={checkOut} />
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-sm font-medium">{dict.guests}</span>
              <Input
                type="number"
                name="guests"
                min={1}
                max={room.capacity}
                value={guests}
                onChange={(e) => setGuests(Math.min(room.capacity, Math.max(1, Number(e.target.value))))}
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 mt-2">
            <span className="text-sm font-medium">{dict.specialRequests}</span>
            <textarea
              name="specialRequests"
              rows={3}
              placeholder={dict.specialRequestsPlaceholder}
              className="w-full rounded-xl border border-slate-900/[0.08] bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </label>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-slate-900/[0.08] bg-card p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{dict.paymentMethod}</h2>
          <PaymentSelector
            defaultValue={paymentMethod}
            name="paymentMethod"
            dict={dict.paymentMethods}
            onChange={setPaymentMethod}
          />

          {/* Karta tanlansa — xom karta raqami/CVV BU YERDA umuman
              so'ralmaydi. Haqiqiy to'lov keyingi qadamda (bron detail
              sahifasida) to'lov provayderining HAQIQIY xavfsiz sahifasiga
              redirect orqali amalga oshiriladi. */}
          {paymentMethod !== "cash" && (
            <div className="mt-1 flex items-start gap-2 rounded-xl border border-slate-200 bg-white p-3 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              <span>{dict.secureCardNotice}</span>
            </div>
          )}
        </section>
      </div>

      <aside className="flex h-fit flex-col gap-3 rounded-xl border border-slate-900/[0.08] bg-card p-5 lg:sticky lg:top-24 shadow-float">
        <h2 className="text-lg font-semibold">{dict.summary}</h2>
        <div>
          <p className="font-medium">{hotelName}</p>
          <p className="text-sm text-slate-500">{room.name}</p>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">
            {formatSum(room.priceSum)} × {nights} {dict.nights}
          </span>
          <span>{formatSum(room.priceSum * nights)}</span>
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-sm text-green-600 font-medium">
            <span>Chegirma ({promoCode})</span>
            <span>-{formatSum(discountAmount)}</span>
          </div>
        )}

        <div className="border-t border-slate-900/[0.08] pt-3 dark:border-slate-800">
          <label className="flex flex-col gap-1">
            <span className="text-xs font-semibold text-slate-500">{dict.promoCode}</span>
            <div className="flex gap-2">
              <Input
                name="promoCode"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="PROMO2025"
                className="text-sm"
              />
              <Button type="button" variant="secondary" onClick={handleApplyPromo} loading={promoLoading} className="px-3 rounded-full active:scale-[0.97]">{dict.applyPromo}</Button>
            </div>
            {promoError && <span className="text-xs text-red-500 mt-1">{promoError}</span>}
            {promoDiscount && <span className="text-xs text-green-600 mt-1">Chegirma qo'llanildi: {promoDiscount.type.startsWith("percent") ? promoDiscount.value + "%" : formatSum(promoDiscount.value)}</span>}
          </label>
        </div>

        <div className="flex justify-between border-t border-slate-900/[0.08] pt-3 font-semibold dark:border-slate-800">
          <span>{dict.total}</span>
          <span>{formatSum(total)}</span>
        </div>

        {nights < 1 && (
          <p className="text-sm text-amber-600">{dict.needDates}</p>
        )}
        {state.error && (
          <p className="text-sm text-red-600">
            {getErrorMessage(state.error)}
          </p>
        )}

        <div className="mt-2 w-full">
          <label className="flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              name="agreeTerms"
              required
              className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-slate-600 dark:text-slate-400 leading-tight">
              {dict.agreeTermsPrefix}
              <Link href={`/${locale}/terms`} target="_blank" className="font-semibold text-primary-600 hover:underline">
                {dict.termsLink}
              </Link>
              {dict.agreeTermsSuffix}
            </span>
          </label>
        </div>

        <div id="checkout-original-cta" className="w-full mt-2">
          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="w-full rounded-full active:scale-[0.97]"
            loading={pending}
            disabled={nights < 1}
          >
            {dict.payButton || dict.confirm}
          </Button>
        </div>
      </aside>

      <CheckoutMobileCtaBar
        total={total}
        dict={{ total: dict.total, payButton: dict.payButton }}
        pending={pending}
        disabled={nights < 1}
        targetId="checkout-original-cta"
      />
    </form>
    </>
  );
}
