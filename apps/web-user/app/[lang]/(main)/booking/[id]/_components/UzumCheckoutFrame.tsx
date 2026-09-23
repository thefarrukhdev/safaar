"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { checkPaymentStatusAction } from "@/lib/payments/actions";

const POLL_INTERVAL_MS = 2500;
const MAX_POLL_ATTEMPTS = 40; // ~100s postMessage kelgandan keyin

/**
 * Uzum Checkout'ni SAFAAR sahifasi ICHIDA (iframe) ko'rsatadi — foydalanuvchi
 * boshqa domenga o'tkazilmaydi. Karta raqami/CVV/muddat SAFAAR kodiga
 * HECH QACHON tegmaydi: iframe kross-origin bo'lgani uchun uning ichidagi
 * forma ma'lumotlariga bu komponent (yoki umuman SAFAAR JS) prinsipial
 * ravishda kira olmaydi — buni brauzerning o'zi ta'minlaydi.
 *
 * MUHIM XAVFSIZLIK QOIDASI: Uzum'ning HAQIQIY postMessage payload shakli
 * hali real sandbox orqali tasdiqlanmagan (qarang audit hisobotlari).
 * Shu sabab bu komponent payload ICHIDAGI hech qanday maydonga
 * (status/action/errorCode va h.k.) ISHONMAYDI. Tasdiqlangan origindan
 * kelgan HAR QANDAY xabar faqat "backend holatini qayta tekshir" signali
 * sifatida ishlatiladi — "to'landi" degan yakuniy qaror FAQAT
 * `GET /payments/:bookingId` (backend, webhook orqali tasdiqlangan holat)
 * orqali qabul qilinadi.
 */
export function UzumCheckoutFrame({
  checkoutUrl,
  bookingId,
  guestToken,
  title,
  onPaid,
  onClose,
}: {
  checkoutUrl: string;
  bookingId: string;
  guestToken?: string;
  title?: string;
  onPaid: () => void;
  onClose: () => void;
}) {
  const [verifying, setVerifying] = useState(false);
  const [failed, setFailed] = useState(false);
  const pollAttempts = useRef(0);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const expectedOrigin = useRef<string | null>(null);

  useEffect(() => {
    try {
      expectedOrigin.current = new URL(checkoutUrl).origin;
    } catch {
      expectedOrigin.current = null;
    }
  }, [checkoutUrl]);

  useEffect(() => {
    function stopPolling() {
      if (pollTimer.current) {
        clearTimeout(pollTimer.current);
        pollTimer.current = null;
      }
    }

    function pollStatus() {
      pollAttempts.current += 1;
      checkPaymentStatusAction(bookingId, guestToken).then((result) => {
        if (result.status === "paid") {
          stopPolling();
          onPaid();
          return;
        }
        if (result.status === "failed") {
          stopPolling();
          setVerifying(false);
          setFailed(true);
          return;
        }
        if (pollAttempts.current >= MAX_POLL_ATTEMPTS) {
          stopPolling();
          setVerifying(false);
          return;
        }
        pollTimer.current = setTimeout(pollStatus, POLL_INTERVAL_MS);
      });
    }

    function handleMessage(event: MessageEvent) {
      if (!expectedOrigin.current || event.origin !== expectedOrigin.current) {
        return;
      }
      setFailed(false);
      setVerifying(true);
      pollAttempts.current = 0;
      stopPolling();
      pollStatus();
    }

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      stopPolling();
    };
  }, [bookingId, guestToken, onPaid]);

  return (
    <Modal isOpen onClose={onClose} title={title ?? "Xavfsiz to'lov — Uzum Checkout"}>
      <div className="flex h-[70vh] w-full min-w-[320px] flex-col gap-2 sm:h-[600px]">
        {verifying && (
          <div className="flex items-center gap-2 rounded-lg bg-primary-50 px-3 py-2 text-xs font-medium text-primary-700 dark:bg-primary-950/40 dark:text-primary-300">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            To&apos;lov tekshirilmoqda...
          </div>
        )}

        {failed && (
          <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
            To&apos;lov amalga oshmadi. Qayta urinib ko&apos;ring yoki oynani yoping.
          </div>
        )}

        <iframe
          src={checkoutUrl}
          title="Uzum Checkout"
          className="h-full w-full flex-1 rounded-xl border-0"
          allow="payment"
        />
      </div>
    </Modal>
  );
}
