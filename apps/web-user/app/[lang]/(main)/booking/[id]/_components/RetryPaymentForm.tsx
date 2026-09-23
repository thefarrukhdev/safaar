"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2 } from "lucide-react";
import { createPaymentSessionAction, previewPayment, type RetryPaymentState } from "@/lib/payments/actions";
import { PaymentSelector, type PaymentMethodId } from "@/components/features/checkout/PaymentSelector";
import { Button } from "@/components/ui/Button";
import { formatSum } from "@/lib/money";
import type { PaymentResult } from "@/lib/services/payments/payments";
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

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_TOKEN_INVALID: "Sessiyangiz tugagan yoki token yaroqsiz. Iltimos, qayta kiring.",
  AUTH_SESSION_REVOKED: "Sessiyangiz bekor qilingan. Iltimos, qayta kiring.",
  BOOKING_FORBIDDEN: "Bu bron sizga tegishli emas.",
  BOOKING_EXPIRED: "Bron topilmadi yoki muddati tugagan.",
  PAYMENT_PROVIDER_NOT_CONFIGURED: "Bu to'lov usuli hozircha mavjud emas. Boshqa usulni tanlab ko'ring.",
  INVALID_BOOKING: "Bron topilmadi.",
  ERROR: "To'lovni amalga oshirishda xatolik yuz berdi. Qayta urinib ko'ring.",
};

function errorMessage(code?: string): string {
  if (!code) return ERROR_MESSAGES.ERROR;
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.ERROR;
}

export function RetryPaymentForm({
  bookingId,
  locale,
  initialProvider = "uzcard",
  guestToken,
  bookingAmount,
}: {
  bookingId: string;
  locale: string;
  initialProvider?: PaymentMethodId;
  guestToken?: string;
  bookingAmount: number;
}) {
  const [selected, setSelected] = useState<PaymentMethodId>(
    ONLINE_METHODS.includes(initialProvider) ? initialProvider : "uzcard",
  );
  const [preview, setPreview] = useState<PaymentResult | null>(null);
  const [previewError, setPreviewError] = useState<string | undefined>();
  const [isPreviewing, startPreview] = useTransition();
  const requestSeq = useRef(0);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [iframeUrl, setIframeUrl] = useState<string | null>(null);

  const [state, formAction, isConfirming] = useActionState<RetryPaymentState, FormData>(
    createPaymentSessionAction,
    {},
  );

  // Fallback yo'l: agar client state yo'qolib, forma `createPaymentSessionAction`
  // orqali qayta yuborilsa, natijadagi URL shu yerda iframe sifatida ochiladi
  // (endi hech qachon boshqa domenga redirect qilinmaydi).
  useEffect(() => {
    if (state.url) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIframeUrl(state.url);
    }
  }, [state.url]);

  const handlePayClick = () => {
    if (preview?.paymentUrl) {
      setIframeUrl(preview.paymentUrl);
      return;
    }
    formRef.current?.requestSubmit();
  };

  const runPreview = (provider: PaymentMethodId) => {
    setPreviewError(undefined);
    const seq = ++requestSeq.current;
    startPreview(async () => {
      const result = await previewPayment(bookingId, provider, guestToken);
      // Eskirgan (stale) javobni e'tiborsiz qoldiramiz — foydalanuvchi
      // tez-tez usul almashtirsa, faqat ENG OXIRGI so'rov natijasi qabul
      // qilinadi (poyga holati oldini olish).
      if (seq !== requestSeq.current) return;
      if (result.error) {
        setPreviewError(result.error);
        setPreview(null);
        return;
      }
      setPreview(result.payment ?? null);
    });
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    runPreview(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelect = (id: PaymentMethodId) => {
    setSelected(id);
    setPreview(null);
    runPreview(id);
  };

  // Backend boshqa (yangi so'ralgan) usulga o'ta olmasligi mumkin — agar
  // eski to'lov allaqachon haqiqiy tashqi sessiyaga ega bo'lsa (masalan
  // To'lov tizimida ro'yxatdan o'tgan buyurtma). Bu holda javobdagi `provider`
  // foydalanuvchi tanlagan bilan mos kelmaydi — buni aniq ko'rsatamiz,
  // xato deb yashirmaymiz (docs 3-bo'lim).
  const providerMismatch = Boolean(preview && preview.provider !== selected);
  const busy = isPreviewing || isConfirming;
  const hasFee = Boolean(preview && preview.feeAmount > 0 && !providerMismatch);

  return (
    <form ref={formRef} action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="bookingId" value={bookingId} />
      {guestToken && <input type="hidden" name="guestToken" value={guestToken} />}

      <PaymentSelector
        defaultValue={selected}
        name="paymentMethod"
        allow={ONLINE_METHODS}
        onChange={handleSelect}
        disabled={busy}
      />

      {/* Fee / yakuniy summa paneli — HAMMA raqam backend'dan (preview'dan),
          frontend hech qanday fee/jamini mustaqil hisoblamaydi. */}
      <div className="flex flex-col gap-1.5 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center justify-between">
          <span className="text-slate-500 dark:text-slate-400">Bron summasi</span>
          <span className="font-semibold text-slate-900 dark:text-white">
            {formatSum(preview?.baseAmount ?? bookingAmount)}
          </span>
        </div>
        {hasFee && (
          <div className="flex items-center justify-between">
            <span className="text-slate-500 dark:text-slate-400">
              {METHOD_LABELS[selected] ?? selected} to'lov haqi ({((preview!.feeRate) * 100).toFixed(1)}%)
            </span>
            <span className="font-semibold text-amber-700 dark:text-amber-400">
              + {formatSum(preview!.feeAmount)}
            </span>
          </div>
        )}
        <div className="mt-1 flex items-center justify-between border-t border-slate-200 pt-1.5 dark:border-slate-800">
          <span className="font-bold text-slate-900 dark:text-white">Jami to'lanadigan summa</span>
          <span className="flex items-center gap-1.5 font-extrabold text-primary-700 dark:text-primary-400">
            {isPreviewing && !preview && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {formatSum(!providerMismatch && preview ? preview.amount : bookingAmount)}
          </span>
        </div>
      </div>

      {/* MUHIM: `providerMismatch` bo'lsa ham forma hamon joriy `selected`
          qiymatini yuboradi — bu XATO EMAS. Backend
          (`PaymentsService.createPayment()`) so'ralgan usul mavjud, hali
          yakunlanmagan HAQIQIY tashqi sessiyaga mos kelmasa, uni jim
          tashlab yubormaydi — o'sha ESKI (eski `preview.provider`) qatorni
          o'zining haqiqiy `payment_url`i bilan qaytaradi. Shu sabab tugma
          bosilganda foydalanuvchi baribir TO'G'RI (eski, hali kutilayotgan)
          checkoutga yo'naltiriladi — frontend buni qo'lda qayta yozishi
          shart emas. */}
      {providerMismatch && preview && (
        <p className="flex items-start gap-2 text-xs font-medium text-amber-700 dark:text-amber-400">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          Siz avval boshlagan <strong>{METHOD_LABELS[preview.provider] ?? preview.provider}</strong> orqali
          to'lov hali kutilmoqda. Avval o'shani yakunlang (pastdagi tugma orqali) yoki bir necha daqiqadan
          so'ng qayta urinib ko'ring.
        </p>
      )}

      {previewError && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {errorMessage(previewError)}
        </p>
      )}

      {state.error && (
        <p className="text-sm font-medium text-red-600 dark:text-red-400">
          {errorMessage(state.error)}
        </p>
      )}

      <Button
        type="button"
        onClick={handlePayClick}
        variant="accent"
        size="lg"
        loading={isConfirming}
        disabled={busy || (!preview?.paymentUrl && !providerMismatch)}
        className="w-full font-bold shadow-md"
      >
        {providerMismatch
          ? `Oldingi to'lovni yakunlash (${METHOD_LABELS[preview?.provider ?? ""] ?? ""})`
          : `To'lash — ${formatSum(preview ? preview.amount : bookingAmount)}`}
      </Button>

      {iframeUrl && (
        <UzumCheckoutFrame
          checkoutUrl={iframeUrl}
          bookingId={bookingId}
          guestToken={guestToken}
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
