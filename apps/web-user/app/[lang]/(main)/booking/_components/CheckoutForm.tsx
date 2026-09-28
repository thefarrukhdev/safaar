"use client";

import Link from "next/link";
import { useActionState, useState, useRef } from "react";
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

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodId>("card" as any);
  const [isSmsLoading, setIsSmsLoading] = useState(false);
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  
  const formRef = useRef<HTMLFormElement>(null);
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
      setPromoError(res.error || dict.errors?.PROMO_INVALID || "Promo kod noto'g'ri");
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

  const handleOnSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    if (false) { // Skip SMS logic completely now
      e.preventDefault();
      
      if (!formRef.current?.checkValidity()) {
        formRef.current?.reportValidity();
        return;
      }
      
      setIsSmsLoading(true);
      setTimeout(() => {
         setIsSmsLoading(false);
         setShowSmsModal(true);
      }, 1500);
    }
  };

  return (
    <>
    <form
      ref={formRef}
      onSubmit={handleOnSubmit}
      action={handleSubmitForm}
      className="grid grid-cols-1 gap-8 lg:gap-12 lg:grid-cols-[1fr_380px] xl:grid-cols-[1fr_420px] items-start"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="roomId" value={room.id} />

      <div className="flex flex-col gap-8">
        <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{dict.guestDetails}</h2>
          
          {isGuest ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dict.firstName}</span>
                <Input
                  name="firstName"
                  autoComplete="given-name"
                  required
                  placeholder={dict.firstName}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dict.lastName}</span>
                <Input
                  name="lastName"
                  autoComplete="family-name"
                  required
                  placeholder={dict.lastName}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dict.email}</span>
                <Input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="example@mail.com"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dict.phone}</span>
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
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dict.fullName}</span>
              <Input
                name="fullName"
                autoComplete="name"
                placeholder={dict.fullNamePlaceholder}
              />
            </label>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <DatePicker
                locale={locale}
                label={dict.checkIn}
                value={checkIn}
                onChange={setCheckIn}
                min={new Date().toISOString().split("T")[0]}
              />
              <input type="hidden" name="checkIn" value={checkIn} />
            </div>
            <div className="flex flex-col gap-1.5">
              <DatePicker
                locale={locale}
                label={dict.checkOut}
                value={checkOut}
                onChange={setCheckOut}
                min={checkIn || new Date().toISOString().split("T")[0]}
              />
              <input type="hidden" name="checkOut" value={checkOut} />
            </div>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dict.guests}</span>
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

          <label className="flex flex-col gap-1.5 mt-2">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dict.specialRequests}</span>
            <textarea
              name="specialRequests"
              rows={3}
              placeholder={dict.specialRequestsPlaceholder}
              className="w-full rounded-xl border border-slate-900/50 bg-white px-4 py-3 text-base text-slate-900 placeholder:text-slate-900/60 transition-[border-color,box-shadow] duration-200 hover:border-slate-900/70 focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:hover:border-slate-600 dark:placeholder:text-slate-400"
            />
          </label>
        </section>

        <section className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-6 md:p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">{dict.paymentMethod}</h2>
          <PaymentSelector
            defaultValue="card"
            name="paymentMethod"
            
            dict={dict.paymentMethods}
            onChange={setPaymentMethod}
          />
          
          
        </section>
      </div>

      <aside className="flex h-fit flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:sticky lg:top-28 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{dict.summary}</h2>
        <div className="flex flex-col gap-0.5">
          <p className="font-semibold text-slate-900 dark:text-white">{hotelName}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">{room.name}</p>
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

        <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dict.promoCode}</span>
            <div className="flex gap-2">
              <Input
                name="promoCode"
                value={promoCode}
                onChange={(e) => setPromoCode(e.target.value)}
                placeholder="PROMO2025"
              />
              <Button type="button" variant="secondary" onClick={handleApplyPromo} loading={promoLoading} className="px-4 rounded-xl active:scale-[0.97]">{dict.applyPromo}</Button>
            </div>
            {promoError && <span className="text-xs font-medium text-red-600 mt-1">{promoError}</span>}
            {promoDiscount && <span className="text-xs font-medium text-green-600 mt-1">{(dict as any).promoApplied || "Chegirma qo'llanildi:"} {promoDiscount.type.startsWith("percent") ? promoDiscount.value + "%" : formatSum(promoDiscount.value)}</span>}
          </label>
        </div>

        <div className="flex justify-between border-t border-slate-100 pt-4 text-lg font-bold dark:border-slate-800">
          <span className="text-slate-900 dark:text-white">{dict.total}</span>
          <span className="text-slate-900 dark:text-white">{formatSum(total)}</span>
        </div>

        {nights < 1 && (
          <p className="text-sm text-amber-600">{dict.needDates}</p>
        )}
        {state.error && (
          <p className="text-sm text-red-600">
            {getErrorMessage(state.error)}
          </p>
        )}

        <div className="mt-4 w-full">
          <label className="flex items-start gap-2.5 text-xs">
            <input type="checkbox" name="agreeTerms" checked={agreeTerms} onChange={(e) => setAgreeTerms(e.target.checked)} required
              className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300 text-primary-600 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-900"
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
            className="w-full rounded-xl py-6 text-base font-bold active:scale-[0.98] transition-transform"
            loading={pending || isSmsLoading}
            disabled={nights < 1 || !agreeTerms}
          >
            {dict.payButton || dict.confirm}
          </Button>
        </div>
      </aside>

      <CheckoutMobileCtaBar
        total={total}
        dict={{ total: dict.total, payButton: dict.payButton }}
        pending={pending || isSmsLoading}
        disabled={nights < 1 || !agreeTerms}
        targetId="checkout-original-cta"
      />

      
    </form>
    </>
  );
}
