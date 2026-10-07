import Link from "next/link";
import { notFound } from "next/navigation";
import {
 AlertTriangle,
 CheckCircle2,
 Clock,
 CreditCard,
 RotateCcw,
 ShieldCheck,
 XCircle,
} from "lucide-react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSession } from "@/lib/auth/session";
import { api, ApiRequestError } from "@/lib/api";
import { formatSum } from "@/lib/money";
import { BackButton } from "@/components/ui/BackButton";
import { RetryPaymentForm } from "./_components/RetryPaymentForm";
import { BookingActions } from "./_components/BookingActions";
import { BookingChat } from "./_components/BookingChat";
import { AutoRefresh } from "./_components/AutoRefresh";
import type { BookingView } from "@/types/view";
import type { PaymentProvider } from "@/lib/services/payments/payments";

type SearchParams = Record<string, string | string[] | undefined>;

function one(value: string | string[] | undefined): string | undefined {
 return Array.isArray(value) ? value[0] : value;
}

async function getBookingOrNull(
 id: string,
 token?: string,
 guestToken?: string,
) {
 try {
 return await api.bookings.getBooking(
 id,
 token || guestToken ? { token, guestToken } : undefined,
 );
 } catch (error) {
 // 404 (bron topilmadi) va 401/403 (token yo'q/yaroqsiz/muddati
 // tugagan yoki boshqa bronga tegishli) — ikkalasida ham xom bron
 // ID'ini "mavjud/mavjud emas"ligini tashqi kuzatuvchiga bildirmasdan,
 // BIR XIL xavfsiz "topilmadi" holatiga tushiriladi (enumeration'ga
 // qarshi, va guest-token muddati tugagan holatda ham sahifa CRASH
 // bo'lish o'rniga xuddi shu, allaqachon mavjud xato holatini ko'rsatadi).
 if (
 error instanceof ApiRequestError &&
 (error.statusCode === 404 ||
 error.statusCode === 401 ||
 error.statusCode === 403)
 ) {
 return null;
 }
 throw error;
 }
}

export default async function BookingDetailPage({
 params,
 searchParams,
}: {
 params: Promise<{ lang: string; id: string }>;
 searchParams: Promise<SearchParams>;
}) {
 const { lang, id } = await params;
 if (!isLocale(lang)) notFound();
 const locale = lang as Locale;
 const sp = await searchParams;

 const paymentQuery = one(sp.payment);
 
 const providerQuery = one(sp.provider);
 const guestTokenQuery = one(sp.guestToken);

 const [dict, checkoutDict, session] = await Promise.all([
 getDictionary(locale, "booking"),
 getDictionary(locale, "checkout"),
 getSession(),
 ]);

 const booking: BookingView | null = await getBookingOrNull(
 id,
 session?.accessToken,
 guestTokenQuery,
 );

 if (!booking) {
 return (
 <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center px-6 py-24 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 mb-4">
        <AlertTriangle className="h-8 w-8 text-amber-600" />
      </div>
      <h1 className="mb-2 text-2xl font-bold text-slate-900">Topilmadi</h1>
      <p className="mb-8 text-slate-500">
        {dict.error}
      </p>
      <Link
        href={`/${locale}`}
        className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800"
      >
        Bosh sahifaga qaytish
      </Link>
    </main>
 );
 }

 const statuses = dict.statuses as Record<string, string>;
 const paymentStatuses = dict.paymentStatuses as Record<string, string>;
 const statusLabel = statuses[booking.status] ?? booking.status;
 const payment = booking.payment;

 const isConfirmed = booking.status === "CONFIRMED" || payment?.status === "paid" || booking.status === "COMPLETED";

 const isFailed = paymentQuery === "failed" || payment?.status === "failed";
 const isAwaitingCash =
 paymentQuery === "cash" || payment?.status === "awaiting_cash";
 // Backend'dagi REAL to'lov holatlari (`payments.status`): pending,
 // awaiting_cash, processing, paid, failed, refunded, reversed. Backend
 // — yagona haqiqat manbai; redirect query parametrlari (`paymentQuery`)
 // faqat UI matnini tezroq ko'rsatish uchun, hech qachon `payment.status`
 // o'rnini bosmaydi (docs/frontend-payment-integration.md, 6-bo'lim).
 const isRefunded =
 payment?.status === "refunded" || payment?.status === "reversed";
 const isCancelled = booking.status.toLowerCase() === "cancelled";
 const isProcessing =
 !isConfirmed && !isFailed && !isRefunded && !isCancelled && payment?.status === "processing";

 return (
 <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
 <AutoRefresh isProcessing={isProcessing} />
 {/* Desktop Side Button */}
 <div className="absolute -left-12 top-12 hidden lg:block">
 <BackButton />
 </div>

 <div className="mb-2 lg:hidden">
 <BackButton />
 </div>

 <div className="flex flex-col overflow-hidden rounded-[24px] border border-slate-200/80 bg-white ">
 {isConfirmed ? (
 <div className="flex flex-col gap-2 bg-emerald-50/80 p-6 sm:p-8 ">
 <div className="flex items-center gap-3">
 <CheckCircle2 className="h-7 w-7 shrink-0 text-emerald-600 " />
 <h1 className="text-xl font-extrabold tracking-tight text-emerald-950 sm:text-2xl">
 {dict.confirmedTitle}
 </h1>
 </div>
 <p className="text-sm font-medium text-emerald-800 ">
 {dict.confirmedSubtitle}
 </p>
 </div>
 ) : isFailed ? (
 <div className="flex flex-col gap-2 bg-red-50/80 p-6 sm:p-8 ">
 <div className="flex items-center gap-3">
 <AlertTriangle className="h-7 w-7 shrink-0 text-red-600 " />
 <h1 className="text-xl font-extrabold tracking-tight text-red-950 sm:text-2xl">
 {dict.failedTitle}
 </h1>
 </div>
 <p className="text-sm font-medium text-red-800 ">
 {dict.failedSubtitle}
 </p>
 </div>
 ) : isAwaitingCash ? (
 <div className="flex flex-col gap-2 bg-amber-50/80 p-6 sm:p-8 ">
 <div className="flex items-center gap-3">
 <ShieldCheck className="h-7 w-7 shrink-0 text-amber-600 " />
 <h1 className="text-xl font-extrabold tracking-tight text-amber-950 sm:text-2xl">
 {dict.awaitingCashTitle}
 </h1>
 </div>
 <p className="text-sm font-medium text-amber-800 ">
 {dict.awaitingCashSubtitle}
 </p>
 </div>
 ) : isRefunded ? (
 <div className="flex flex-col gap-2 bg-white p-6 sm:p-8 ">
 <div className="flex items-center gap-3">
 <RotateCcw className="h-7 w-7 shrink-0 text-slate-600 " />
 <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">
 {dict.refundedTitle}
 </h1>
 </div>
 <p className="text-sm font-medium text-slate-600 ">
 {payment?.status === "reversed"
 ? "{dict.refundedReversedSubtitle}"
 : "{dict.refundedSubtitle}"}
 </p>
 </div>
 ) : isProcessing ? (
 <div className="flex flex-col gap-2 bg-blue-50/80 p-6 sm:p-8 ">
 <div className="flex items-center gap-3">
 <Clock className="h-7 w-7 shrink-0 animate-pulse text-blue-600 " />
 <h1 className="text-xl font-extrabold tracking-tight text-blue-950 sm:text-2xl">
 {dict.processingTitle}
 </h1>
 </div>
 <p className="text-sm font-medium text-blue-800 ">
 {dict.processingSubtitle}
 </p>
 </div>
 ) : isCancelled ? (
 <div className="flex flex-col gap-2 bg-slate-100 p-6 sm:p-8 ">
 <div className="flex items-center gap-3">
 <XCircle className="h-7 w-7 shrink-0 text-slate-600 " />
 <h1 className="text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{dict.cancelledTitle}</h1>
 </div>
 <p className="text-sm font-medium text-slate-600 ">
 {dict.cancelledSubtitle}
 </p>
 </div>
 ) : (
 <div className="bg-white p-6 sm:p-8 ">
 <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 ">
 {dict.title}
 </h1>
 </div>
 )}

 <section
 aria-label={dict.receiptSummary}
 className="relative flex flex-col gap-5 p-6 sm:p-8 bg-white "
 >
 
 <div className="flex items-center justify-between border-b border-slate-100 pb-4 ">
 <span className="text-xs font-bold uppercase tracking-wider text-slate-500 ">
 {dict.receiptSummary}
 </span>
 <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-bold text-blue-800 ">
 {statusLabel}
 </span>
 </div>

 <Row label={dict.number} value={booking.bookingNumber || id} />

 {booking.createdAt && (
 <Row label={dict.createdAt}>
 <span className="text-sm font-medium text-slate-700 ">
 {new Date(booking.createdAt).toLocaleString(locale)}
 </span>
 </Row>
 )}

 <Row label={dict.total} value={formatSum(booking.totalSum)} />

 {payment && (
 <Row label={dict.payment} className="mt-2 border-t border-slate-100 pt-4 ">
 <span className="flex items-center gap-2 text-sm font-semibold capitalize text-slate-900 ">
 {payment.provider ? `${payment.provider.toUpperCase()}` : ""}
 <span className="rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-slate-600 ">
 {paymentStatuses[payment.status] ?? payment.status}
 </span>
 </span>
 </Row>
 )}
 </section>
 </div>

 {(!isConfirmed && !isAwaitingCash && !isRefunded && !isCancelled) || isFailed ? (
 <section className="flex flex-col gap-4 rounded-xl border border-slate-900/[0.08] bg-card p-6 ">
 <div className="flex items-center justify-between gap-2">
 <div className="flex items-center gap-2">
 <CreditCard className="h-5 w-5 text-blue-600 " />
 <h2 className="text-lg font-bold text-slate-900 ">
 {isFailed || isProcessing ? dict.reselectPaymentMethod : dict.selectPaymentMethod}
 </h2>
 </div>
 {isProcessing && (
 <a
 href={`/${locale}/booking/${booking.id}${guestTokenQuery ? `?guestToken=${encodeURIComponent(guestTokenQuery)}` : ""}`}
 className="text-xs font-semibold text-blue-600 hover:underline "
 >{dict.refreshStatus}</a>
 )}
 </div>
 <p className="text-xs text-slate-500 ">
 {dict.paymentInstructions}
 </p>

 <RetryPaymentForm
 bookingId={booking.id}
 locale={locale}
 initialProvider={(providerQuery as PaymentProvider) ?? (payment?.provider as PaymentProvider) ?? "uzcard"}
 guestToken={guestTokenQuery}
 bookingAmount={booking.totalSum}
 existingPayment={
 payment?.status === "processing"
 ? {
 provider: (payment.provider as PaymentProvider) || "uzcard",
 status: payment.status,
 url: payment.url,
 amount: payment.amount,
 }
 : undefined
 }
  dict={dict} paymentMethodsDict={checkoutDict.paymentMethods} />
 </section>
 ) : null}

 <BookingActions
 locale={locale}
 isConfirmed={isConfirmed}
 isCancelled={isCancelled}
 bookingId={booking.id}
 totalSum={booking.totalSum}
 paymentMethod={payment?.provider || "online"}
 token={session?.accessToken}
 guestToken={guestTokenQuery}
 dict={{
 voucher: dict.voucher,
 backHome: dict.backHome,
 actions: dict.actions,
 cancelModal: dict.cancelModal,
 }}
 />

 {session?.accessToken && (
 <section className="mt-8">
 <BookingChat
 bookingId={booking.id}
 token={session.accessToken}
 dict={dict.chat}
 locale={locale}
 />
 </section>
 )}
 </main>
 );
}

function Row({
 className,
 label,
 value,
 children,
}: {
 label: string;
 value?: string;
 className?: string;
 children?: React.ReactNode;
}) {
 return (
 <div className={`flex items-center justify-between gap-4 py-1 ${className || ""}`}>
 <span className="text-sm text-slate-500 ">{label}</span>
 {children ?? (
 <span className="font-semibold text-slate-900 ">
 {value}
 </span>
 )}
 </div>
 );
}
