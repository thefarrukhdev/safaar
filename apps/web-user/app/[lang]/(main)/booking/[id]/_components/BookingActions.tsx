"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Printer, ArrowLeft, XCircle } from "lucide-react";
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
  };
}) {
  const router = useRouter();
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  
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
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setLoadingPreview(false);
    }
  };

  const confirmCancel = async () => {
    if (!bookingId) return;
    setCancelling(true);
    setError(null);
    try {
      await api.bookings.cancelBooking(bookingId, "Foydalanuvchi bekor qildi", { token });
      setCancelModalOpen(false);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Xatolik yuz berdi");
    } finally {
      setCancelling(false);
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
            className="gap-2 font-bold"
          >
            <Printer className="h-4 w-4" />
            {dict.voucher || "Vaucherni chop etish"}
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
            className="gap-2 font-bold text-red-600 hover:text-red-700 dark:text-red-500"
          >
            <XCircle className="h-4 w-4" />
            Bekor qilish
          </Button>
        )}

        <Link href={`/${locale}/account/bookings`}>
          <Button variant="secondary" size="lg" className="font-bold">
            Mening bronlarim
          </Button>
        </Link>

        <Link href={`/${locale}`}>
          <Button variant="ghost" size="lg" className="gap-2 font-semibold">
            <ArrowLeft className="h-4 w-4" />
            {dict.backHome || "Bosh sahifaga"}
          </Button>
        </Link>
      </div>

      <Modal
        isOpen={cancelModalOpen}
        onClose={() => !cancelling && setCancelModalOpen(false)}
        title="Bronni bekor qilish"
      >
        <div className="space-y-4">
          {loadingPreview ? (
            <p className="text-sm text-slate-500">Hisoblanmoqda...</p>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : previewData ? (
            <div className="space-y-3 rounded-lg bg-slate-50 p-4 dark:bg-slate-800">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                Agar siz ushbu bronni bekor qilsangiz, quyidagi qoidalar qo'llaniladi:
              </p>
              <ul className="text-sm space-y-2">
                <li className="flex justify-between">
                  <span className="text-slate-500">To'langan summa:</span>
                  <span className="font-medium">
                    {formatMoney((previewData.paid_amount ?? previewData.paidAmount ?? 0) as number, (previewData.currency as "UZS") || "UZS")}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-500">Qaytariladigan summa:</span>
                  <span className="font-medium text-emerald-600">
                    {formatMoney((previewData.refund_amount ?? previewData.refundAmount ?? 0) as number, (previewData.currency as "UZS") || "UZS")}
                  </span>
                </li>
                <li className="flex justify-between">
                  <span className="text-slate-500">Jarima:</span>
                  <span className="font-medium text-red-600">
                    {formatMoney((previewData.penalty_amount ?? previewData.penaltyAmount ?? 0) as number, (previewData.currency as "UZS") || "UZS")}
                  </span>
                </li>
              </ul>
              {previewData.policy && (
                <div className="mt-4 text-xs text-slate-500">
                  <strong>Qoida:</strong> {previewData.policy}
                </div>
              )}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              variant="ghost"
              onClick={() => setCancelModalOpen(false)}
              disabled={cancelling}
            >
              Yopish
            </Button>
            <Button
              variant="secondary"
              onClick={confirmCancel}
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
              disabled={loadingPreview || cancelling || !!error}
            >
              {cancelling ? "Bekor qilinmoqda..." : "Tasdiqlash"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
