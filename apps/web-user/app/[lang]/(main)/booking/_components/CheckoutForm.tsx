"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { Locale } from "@/i18n/config";
import type { CheckoutDict } from "@/i18n/dictionaries";
import { createBookingAction, type CheckoutState } from "@/lib/booking/actions";
import { formatSum } from "@/lib/money";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { DatePicker } from "@/components/ui/DatePicker";
import { PaymentSelector } from "@/components/features/checkout/PaymentSelector";
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
  dict: CheckoutDict & { firstName?: string; lastName?: string; email?: string; phone?: string };
  hotelId: string;
  hotelName: string;
  room: { id: string; name: string; priceSum: number; capacity: number };
  defaults: { checkIn: string; checkOut: string; guests: number };
  isGuest?: boolean;
}) {
  const [checkIn, setCheckIn] = useState(defaults.checkIn);
  const [checkOut, setCheckOut] = useState(defaults.checkOut);
  const [guests, setGuests] = useState(Math.min(room.capacity, Math.max(1, defaults.guests)));
  const [state, action, pending] = useActionState<CheckoutState, FormData>(
    createBookingAction,
    {},
  );

  const nights = nightsBetween(checkIn, checkOut);
  const total = room.priceSum * Math.max(nights, 0);

  const getErrorMessage = (error: string) => {
    if (error === "ERROR") return dict.error;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const errorsDict = (dict as any).errors as Record<string, string> | undefined;
    return errorsDict?.[error] ?? error;
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
    <form
      action={handleSubmitForm}
      className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]"
    >
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="hotelId" value={hotelId} />
      <input type="hidden" name="roomId" value={room.id} />

      <div className="flex flex-col gap-6">
        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-card p-5 shadow-sm">
          <h2 className="text-lg font-semibold">{dict.guestDetails}</h2>
          
          {isGuest ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{dict.firstName || "Ism"}</span>
                <Input
                  name="firstName"
                  autoComplete="given-name"
                  required
                  placeholder={dict.firstName || "Ism"}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{dict.lastName || "Familiya"}</span>
                <Input
                  name="lastName"
                  autoComplete="family-name"
                  required
                  placeholder={dict.lastName || "Familiya"}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{dict.email || "Elektron pochta"}</span>
                <Input
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="example@mail.com"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm font-medium">{dict.phone || "Telefon raqami"}</span>
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
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-card p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{dict.paymentMethod}</h2>
          <PaymentSelector defaultValue="click" name="paymentMethod" />
        </section>
      </div>

      <aside className="flex h-fit flex-col gap-3 rounded-2xl border border-slate-200 bg-card p-5 shadow-sm lg:sticky lg:top-24">
        <h2 className="text-lg font-semibold">{dict.summary}</h2>
        <div>
          <p className="font-medium">{hotelName}</p>
          <p className="text-sm text-slate-500">{room.name}</p>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">
            {formatSum(room.priceSum)} × {nights} {dict.nights}
          </span>
          <span>{formatSum(total)}</span>
        </div>
        <div className="flex justify-between border-t border-slate-200 pt-3 font-semibold">
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
              Men <Link href={`/${locale}/terms`} target="_blank" className="font-semibold text-primary-600 hover:underline">Ommaviy Oferta</Link> shartlariga roziman.
            </span>
          </label>
        </div>

        <div id="checkout-original-cta" className="w-full mt-2">
          <Button
            type="submit"
            variant="accent"
            size="lg"
            className="w-full"
            loading={pending}
            disabled={nights < 1}
          >
            {dict.confirm}
          </Button>
        </div>
      </aside>

      <CheckoutMobileCtaBar
        total={total}
        totalLabel={dict.total || "Jami"}
        buttonText="To'lash"
        pending={pending}
        disabled={nights < 1}
        targetId="checkout-original-cta"
      />
    </form>
  );
}
