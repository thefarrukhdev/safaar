"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer, ArrowLeft, XCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { trackBookingCompleted } from "@/lib/services/analytics/tracker";
import { api } from "@/lib/api";
import { formatMoney } from "@/lib/money";
import { useRouter } from "next/navigation";


export function BookingActions({
  locale,
  isConfirmed,
  bookingId,
  totalSum,
  paymentMethod = "online",
  token,
  dict,
}: {
  locale: string;
  isConfirmed: boolean;
  bookingId?: string;
  totalSum?: number;
  paymentMethod?: string;
  token?: string;
  dict: {
    voucher?: string;
    backHome?: string;
    actions?: {
      printVoucher?: string;
      cancelBooking?: string;
      myBookings?: string;
      backHome?: string;
      error?: string;
      userCancelledReason?: string;
    };
    cancelModal?: {
      title?: string;
      calculating?: string;
      rulesIntro?: string;
      paidAmount?: string;
      refundAmount?: string;
      penalty?: string;
      penaltyAmount?: string;
      policyLabel?: string;
      cancelling?: string;
      confirm?: string;
      confirmCancel?: string;
      cancel?: string;
    };
    refundModal?: {
      title?: string;
      reasonLabel?: string;
      reasonPlaceholder?: string;
      confirm?: string;
      requesting?: string;
    };
  };
}) {
  const router = useRouter();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [refundModalOpen, setRefundModalOpen] = useState(false);
  const [refundReason, setRefundReason] = useState("");
  const [refunding, setRefunding] = useState(false);
  
  interface PreviewData {
    paid_amount?: number;
    paidAmount?: number;
    refund_amount?: number;
    refundAmount?: number;
    penalty_amount?: number;
    penaltyAmount?: number;
    currency?: string;
    policy?: string;
  }
  
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isConfirmed && bookingId) {
      trackBookingCompleted({
        bookingId,
        totalSum: totalSum || 0,
        paymentMethod,
      });
    }
  }, [isConfirmed, bookingId, totalSum, paymentMethod]);

  const handlePrint = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  const handleCancelClick = async () => {
    if (!bookingId) return;
    setCancelModalOpen(true);
    setLoadingPreview(true);
    setError(null);
    try {
      const data = await api.bookings.cancelPreview(bookingId, { token });
      setPreviewData(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (dict.actions?.error ?? "Xatolik yuz berdi"));
    } finally {
      setLoadingPreview(false);
    }
  };

  const confirmCancel = async () => {
    if (!bookingId) return;
    setCancelling(true);
    setError(null);
    try {
      await api.bookings.cancelBooking(
        bookingId,
        dict.actions?.userCancelledReason ?? "Foydalanuvchi bekor qildi",
        { token }
      );
      setCancelModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (dict.actions?.error ?? "Xatolik yuz berdi"));
    } finally {
      setCancelling(false);
    }
  };

  const handleRefundSubmit = async () => {
    if (!bookingId || !refundReason.trim()) return;
    setRefunding(true);
    setError(null);
    try {
      await api.refunds.createRefund({ booking_id: bookingId, reason: refundReason }, { token });
      setRefundModalOpen(false);
      setRefundReason("");
      router.push(`/${locale}/account/refunds`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : (dict.actions?.error ?? "Xatolik yuz berdi"));
    } finally {
      setRefunding(false);
    }
  };

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 pt-2">
        {isConfirmed && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handlePrint}
            className="gap-2 font-bold rounded-full active:scale-[0.97]"
          >
            <Printer className="h-4 w-4" />
            {dict.actions?.printVoucher ?? dict.voucher ?? "Vaucherni chop etish"}
          </Button>
        )}

        {/* `POST /bookings/:id/cancel(-preview)` — `@Roles(USER, PARTNER,
            ADMIN, SUPER_ADMIN)`, guest-token qo'llab-quvvatlanmaydi
            (controller darajasida). Guestga bu tugmani ko'rsatish har doim
            401 bilan tugaydigan, chalkash amalni taklif qilardi — shu
            sabab faqat `token` (login qilingan sessiya) mavjud bo'lganda
            ko'rsatiladi. */}
        {isConfirmed && bookingId && token && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={handleCancelClick}
            className="gap-2 font-bold text-red-600 hover:text-red-700 dark:text-red-500 rounded-full active:scale-[0.97]"
          >
            <XCircle className="h-4 w-4" />
            {dict.actions?.cancelBooking ?? "Bekor qilish"}
          </Button>
        )}

        {isConfirmed && bookingId && token && (
          <Button
            type="button"
            variant="secondary"
            size="lg"
            onClick={() => setRefundModalOpen(true)}
            className="gap-2 font-bold text-amber-600 hover:text-amber-700 dark:text-amber-500 rounded-full active:scale-[0.97]"
          >
            <RotateCcw className="h-4 w-4" />
            {(dict as any).actions?.requestRefund ?? "Qaytarish so'rash"}
          </Button>
        )}

        <Link href={`/${locale}/account/bookings`}>
          <Button variant="secondary" size="lg" className="font-bold rounded-full active:scale-[0.97]">
            {dict.actions?.myBookings ?? "Mening bronlarim"}
          </Button>
        </Link>

        <Link href={`/${locale}`}>
          <Button variant="ghost" size="lg" className="gap-2 font-semibold rounded-full active:scale-[0.97]">
            <ArrowLeft className="h-4 w-4" />
            {dict.actions?.backHome ?? dict.backHome ?? "Bosh sahifaga"}
          </Button>
        </Link>
      </div>

      <Modal
        isOpen={cancelModalOpen}
        onClose={() => !cancelling && setCancelModalOpen(false)}
        title={dict.cancelModal?.title ?? "Bronni bekor qilish"}
      >
        <div className="space-y-4">
          {loadingPreview ? (
            <p className="text-sm text-slate-500">
              {dict.cancelModal?.calculating ?? "Hisoblanmoqda..."}
            </p>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : previewData ? (
            <div className="space-y-3 rounded-xl bg-slate-900/[0.03] p-4 dark:bg-slate-800">
              {dict.cancelModal?.rulesIntro && (
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  {dict.cancelModal.rulesIntro}
                </p>
              )}
              <ul className="text-sm space-y-2">
                <li className="flex justify-between">
                  <span className="text-slate-500">
                    {dict.cancelModal?.paidAmount ?? "To'langan summa:"}
                  </span>
                  <span className="font-medium">
                    {formatMoney((previewData.paid_amount ?? previewData.paidAmount ?? 0) as number, (previewData.currency as "UZS") || "UZS")}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-500">
                    {dict.cancelModal?.refundAmount ?? "Qaytariladigan summa:"}
                  </span>
                  <span className="font-medium text-emerald-600">
                    {formatMoney((previewData.refund_amount ?? previewData.refundAmount ?? 0) as number, (previewData.currency as "UZS") || "UZS")}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-500">
                    {dict.cancelModal?.penaltyAmount ?? "Jarima:"}
                  </span>
                  <span className="font-medium text-red-600">
                    {formatMoney((previewData.penalty_amount ?? previewData.penaltyAmount ?? 0) as number, (previewData.currency as "UZS") || "UZS")}
                  </span>
                </li>
              </ul>
              {previewData.policy && (
                <div className="mt-4 text-xs text-slate-500">
                  <strong>{dict.cancelModal?.policyLabel ?? "Qoida:"}</strong> {previewData.policy}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-900/[0.08] dark:border-slate-800">
            <Button
              variant="ghost"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancelling}
              className="rounded-full active:scale-[0.97]"
            >
              Yopish
            </Button>
            <Button
              variant="secondary"
              onClick={confirmCancel}
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-full active:scale-[0.97]"
              disabled={loadingPreview || cancelling || !!error}
            >
              {cancelling
                ? (dict.cancelModal?.cancelling ?? "Bekor qilinmoqda...")
                : (dict.cancelModal?.confirm ?? "Tasdiqlash")}
            </Button>
          </div>
        </div>
      </Modal>
      <Modal
        isOpen={refundModalOpen}
        onClose={() => !refunding && setRefundModalOpen(false)}
        title={dict.refundModal?.title ?? "Pulni qaytarishni so'rash"}
      >
        <div className="space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
              {dict.refundModal?.reasonLabel ?? "Sababni kiriting:"}
            </label>
            <textarea
              className="w-full rounded-xl border border-slate-900/[0.08] bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              rows={4}
              placeholder={dict.refundModal?.reasonPlaceholder ?? "Qaytarish sababini batafsil yozing..."}
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              disabled={refunding}
            />
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-900/[0.08] dark:border-slate-800">
            <Button variant="ghost" onClick={() => setRefundModalOpen(false)} disabled={refunding} className="rounded-full active:scale-[0.97]">
              Yopish
            </Button>
            <Button
              onClick={handleRefundSubmit}
              disabled={refunding || !refundReason.trim()}
              className="rounded-full active:scale-[0.97]"
            >
              {refunding ? (dict.refundModal?.requesting ?? "Yuborilmoqda...") : (dict.refundModal?.confirm ?? "Yuborish")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
