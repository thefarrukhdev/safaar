/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle } from "lucide-react";
import { createPaymentSessionAction, type RetryPaymentState } from "@/lib/payments/actions";
import { PaymentSelector, type PaymentMethodId } from "@/components/features/checkout/PaymentSelector";
import { Button } from "@/components/ui/Button";
import { formatSum } from "@/lib/money";
import { UzumCheckoutFrame } from "./UzumCheckoutFrame";

// Onlayn to'lov usullari — "cash" bu yerda ATAYLAB YO'Q: backend
// `POST /payments/:bookingId/create` "cash" uchun payment qatorini
// `awaiting_cash` qiladi, LEKIN bronni tasdiqlash faqat booking
// YARATISHNING o'zida (`confirmCashBookingIfNeeded()`) ishlaydi — shu
// sabab bu (retry/tanlash) bosqichida "cash"ni taklif qilish bron holatini
// hech qachon to'g'ri yakunlamaydigan chalkash holatga olib kelardi.
const ONLINE_METHODS: PaymentMethodId[] = ["uzcard", "humo", "visa", "mastercard"];

const METHOD_LABELS: Record<string, string> = {
 uzcard: "Uzcard",
 humo: "Humo",
 visa: "Visa",
 mastercard: "Mastercard",
 cash: "Joyida to'lash",
};

const CARD_SCHEME_FEE_RATES: Record<string, number> = {
 uzcard: 0.015,
 humo: 0.015,
 visa: 0.035,
 mastercard: 0.035,
};

function calculateFee(base: number, method: PaymentMethodId) {
 const rate = CARD_SCHEME_FEE_RATES[method] ?? 0;
 if (rate === 0 || !Number.isFinite(base) || base <= 0) {
 return { baseAmount: base, feeRate: 0, feeAmount: 0, totalAmount: base };
 }
 
 // Yangi backend mantiqiga ko'ra Gross-up formula (docs/frontend-payment-integration.md)
 const totalAmount = Math.ceil(base / (1 - rate));
 const feeAmount = totalAmount - base;
 
 return {
 baseAmount: base,
 feeRate: rate,
 feeAmount,
 totalAmount,
 };
}

export interface ExistingPaymentInfo {
 provider: PaymentMethodId;
 status: string;
 url?: string;
 amount?: number;
}

export function RetryPaymentForm({
 bookingId,
 locale,
 initialProvider = "uzcard",
 guestToken,
 bookingAmount,
 existingPayment,
  dict,
  paymentMethodsDict,
}: {
 bookingId: string;
 locale: string;
 initialProvider?: PaymentMethodId;
 guestToken?: string;
 bookingAmount: number;
 existingPayment?: ExistingPaymentInfo;
 dict?: any;
  paymentMethodsDict?: any;
}) {
 const [selected, setSelected] = useState<PaymentMethodId>(
 ONLINE_METHODS.includes(initialProvider) ? initialProvider : "uzcard",
 );
 const formRef = useRef<HTMLFormElement>(null);
 const router = useRouter();
 const [iframeUrl, setIframeUrl] = useState<string | null>(null);

 const [state, formAction, isConfirming] = useActionState<RetryPaymentState, FormData>(
 createPaymentSessionAction,
 {},
 );

 // Fallback / muvaffaqiyatli sessiya URL'ini iframe sifatida ochish
 useEffect(() => {
 if (state.url && !state.error) {
 setIframeUrl(state.url);
 }
 }, [state.url, state.error]);

 const hasActiveSession = Boolean(
 existingPayment && existingPayment.status === "processing" && existingPayment.url,
 );
 const isLockedToOther = hasActiveSession && existingPayment!.provider !== selected;
 const stateMismatch = Boolean(state.provider && state.provider !== selected);
 const providerMismatch = isLockedToOther || stateMismatch;
 const mismatchProvider = (stateMismatch ? state.provider : existingPayment?.provider) ?? selected;

 const handlePayClick = () => {
 const directUrl = providerMismatch
 ? state.url || existingPayment?.url
 : hasActiveSession && existingPayment?.provider === selected
 ? existingPayment?.url
 : null;

 if (directUrl) {
 setIframeUrl(directUrl);
 return;
 }

 formRef.current?.requestSubmit();
 };

 const handleSelect = (id: PaymentMethodId) => {
 setSelected(id);
 };

 const fee = calculateFee(bookingAmount, selected);
 const hasFee = fee.feeAmount > 0 && !providerMismatch;

 return (
 <form ref={formRef} action={formAction} className="flex flex-col gap-4">
 <input type="hidden" name="locale" value={locale} />
 <input type="hidden" name="bookingId" value={bookingId} />
 <input type="hidden" name="paymentMethod" value={selected} />
 {guestToken && <input type="hidden" name="guestToken" value={guestToken} />}

 <PaymentSelector
 defaultValue={selected}
 name="paymentMethodSelector"
 allow={ONLINE_METHODS}
 dict={paymentMethodsDict}
 onChange={handleSelect}
 disabled={isConfirming}
 />

 {/* Fee / yakuniy summa paneli */}
 <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
 <div className="flex items-center justify-between">
 <span className="text-slate-500">{dict?.missing?.BronSummasi || "Bron summasi"}</span>
 <span className="font-semibold text-slate-900">
 {formatSum(bookingAmount)}
 </span>
 </div>
 {hasFee && (
 <div className="flex items-center justify-between">
 <span className="text-slate-500">
 {METHOD_LABELS[selected] ?? selected} {dict?.missing?.TolovHaqi || "to'lov haqi ("}{(fee.feeRate * 100).toFixed(1)}%)
 </span>
 <span className="font-semibold text-amber-700">
 + {formatSum(fee.feeAmount)}
 </span>
 </div>
 )}
 <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1.5">
 <span className="font-bold text-slate-900">{dict?.missing?.JamiTolanadigan || "Jami to'lanadigan summa"}</span>
 <span className="flex items-center gap-1.5 font-extrabold text-blue-700">
 {formatSum(providerMismatch && existingPayment?.amount ? existingPayment.amount : fee.totalAmount)}
 </span>
 </div>
 </div>

 {providerMismatch && (
 <p className="flex items-start gap-2 text-xs font-medium text-amber-700">
 <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
 {dict?.missing?.SizAvvalBoshlagan || "Siz avval boshlagan"} <strong>{METHOD_LABELS[mismatchProvider] ?? mismatchProvider}</strong> {dict?.missing?.OrqaliTolovHali || "orqali to'lov hali kutilmoqda. Avval o'shani yakunlang (pastdagi tugma orqali) yoki bir necha daqiqadan so'ng qayta urinib ko'ring."}
 </p>
 )}

 {state.error && (
 <p className="text-sm font-medium text-red-600">
 {dict?.paymentErrors?.[state.error as string] || dict?.paymentErrors?.ERROR || "Error"}
 </p>
 )}

 <Button
 type="button"
 onClick={handlePayClick}
 variant="accent"
 size="lg"
 loading={isConfirming}
 disabled={isConfirming}
 className="w-full font-bold shadow-md"
 >
 {providerMismatch
 ? `${dict?.retryForm?.payNow || "Oldingi to'lovni yakunlash"} (${METHOD_LABELS[mismatchProvider] ?? ""})`
 : `${dict?.retryForm?.payNow || "To'lash"} — ${formatSum(fee.totalAmount)}`}
 </Button>

 {iframeUrl && (
 <UzumCheckoutFrame
 checkoutUrl={iframeUrl}
 bookingId={bookingId}
 guestToken={guestToken}
 title={`To'lov (${METHOD_LABELS[selected] ?? selected})`}
 onClose={() => setIframeUrl(null)}
 onPaid={() => {
 setIframeUrl(null);
 router.refresh();
 }}
 />
 )}
 </form>
 );
}
