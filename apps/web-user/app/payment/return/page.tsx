"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { ThinkingOrb } from "@/components/ui/thinking-orb";

function PaymentReturnContent() {
  const searchParams = useSearchParams();
  const bookingId = searchParams.get("bookingId") ?? "";
  const status = searchParams.get("status") ?? "success";
  const guestToken = searchParams.get("guestToken") ?? "";
  const locale = searchParams.get("locale") ?? searchParams.get("lang") ?? "uz";

  useEffect(() => {
    // Iframe ichida bo'lsa — ota (parent) oynaga xabar yuboramiz.
    // Ota oyna (RetryPaymentForm) bu xabarni qabul qilib, backend orqali
    // to'lov holatini darhol qayta tekshiradi va modalni yopadi.
    try {
      window.parent.postMessage(
        {
          type: "SAFAAR_PAYMENT_RESULT",
          status,
          bookingId,
          guestToken,
        },
        "*",
      );
    } catch {
      // ignore
    }

    const guestParam = guestToken ? `&guestToken=${encodeURIComponent(guestToken)}` : "";
    const redirectStatus = status === "success" ? "&status=confirmed" : "";
    const redirectPath = bookingId
      ? `/${locale}/booking/${encodeURIComponent(bookingId)}?payment=${encodeURIComponent(status)}${redirectStatus}${guestParam}`
      : `/${locale}`;

    // Agar iframe ichida EMAS, butun sahifa (REDIRECT rejimi) bo'lsa — darhol bron sahifasiga o'tamiz
    if (window.top === window.self) {
      window.location.href = redirectPath;
      return;
    }

    // Iframe ichida bo'lsa — agar ota oyna postMessage'ni ushlamasa, xavfsizlik
    // uchun 1.5 soniyadan keyin butun sahifani to'g'ridan-to'g'ri yangilaymiz.
    const timer = setTimeout(() => {
      try {
        if (window.top) {
          window.top.location.href = redirectPath;
        }
      } catch {
        // Cross-origin cheklovi bo'lsa
        window.location.href = redirectPath;
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [bookingId, status, guestToken, locale]);

  const guestParam = guestToken ? `&guestToken=${encodeURIComponent(guestToken)}` : "";
  const targetStatus = status === "success" ? "&status=confirmed" : "";
  const targetUrl = bookingId
    ? `/${locale}/booking/${bookingId}?payment=${status}${targetStatus}${guestParam}`
    : `/${locale}`;

  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center p-6 text-center">
      <div className="flex flex-col items-center gap-3">
        <ThinkingOrb size={16} state="base" />
        <h2 className="text-base font-semibold text-slate-900">
          To&apos;lov tasdiqlanmoqda...
        </h2>
        <p className="text-xs text-slate-500">
          Iltimos kuting, to&apos;lov holati tekshirilmoqda.
        </p>
        <a
          href={targetUrl}
          target="_top"
          className="mt-4 text-xs font-medium text-blue-600 hover:underline active:scale-[0.97]"
        >
          Agar sahifa avtomatik yangilanmasa, bu yerni bosing
        </a>
      </div>
    </div>
  );
}

export default function PaymentReturnPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[300px] items-center justify-center p-6">
          <ThinkingOrb size={16} state="base" />
        </div>
      }
    >
      <PaymentReturnContent />
    </Suspense>
  );
}
