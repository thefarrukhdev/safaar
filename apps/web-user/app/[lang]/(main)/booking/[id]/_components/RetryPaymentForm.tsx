"use client";

import { useActionState } from "react";
import { createPaymentSessionAction, type RetryPaymentState } from "@/lib/payments/actions";
import { PaymentSelector } from "@/components/features/checkout/PaymentSelector";
import { Button } from "@/components/ui/Button";
import type { BookingDict, CheckoutDict } from "@/i18n/dictionaries";

export function RetryPaymentForm({
  bookingId,
  locale,
  initialProvider = "click",
  dict,
  paymentMethodsDict,
}: {
  bookingId: string;
  locale: string;
  initialProvider?: "click" | "payme" | "uzcard" | "humo" | "cash";
  dict?: BookingDict["retryPayment"];
  paymentMethodsDict?: CheckoutDict["paymentMethods"];
}) {
  const [state, action, pending] = useActionState<RetryPaymentState, FormData>(
    createPaymentSessionAction,
    {}
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="bookingId" value={bookingId} />

      <PaymentSelector
        defaultValue={initialProvider}
        name="paymentMethod"
        dict={paymentMethodsDict}
      />

      {state.error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {dict?.error ?? "To'lovni amalga oshirishda xatolik yuz berdi. Qayta urinib ko'ring."}
        </p>
      )}

      <Button
        type="submit"
        variant="accent"
        size="lg"
        loading={pending}
        className="w-full font-bold shadow-md"
      >
        {dict?.submit ?? "Qayta to'lash (To'lov sahifasiga o'tish)"}
      </Button>
    </form>
  );
}
