"use client";

import { useState } from "react";
import { Check, Copy, Ticket } from "lucide-react";
import type { PromoView } from "@safaar/api-client";
import { toast } from "sonner";

function discountLabel(promo: PromoView): string {
  if (promo.discountType === "percent") {
    return `-${promo.discountValue}%`;
  }
  return `-${new Intl.NumberFormat("uz-UZ").format(promo.discountValue)} so'm`;
}

export function PromoCodeCard({ promo }: { promo: PromoView }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopied(true);
      toast.success("Promo kod nusxalandi!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Nusxalashda xatolik yuz berdi.");
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="group flex min-h-[44px] flex-col gap-1.5 rounded-xl border border-dashed border-primary-300 bg-primary-50/60 p-4 text-left transition-colors hover:bg-primary-50 dark:border-primary-800 dark:bg-primary-950/20 dark:hover:bg-primary-950/30"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-black tracking-widest text-primary-700 dark:text-primary-300">
          <Ticket className="h-4 w-4" aria-hidden />
          {promo.code}
        </span>
        {copied ? (
          <Check className="h-4 w-4 text-emerald-600" aria-hidden />
        ) : (
          <Copy className="h-4 w-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300" aria-hidden />
        )}
      </div>
      <span className="text-lg font-bold text-slate-900 dark:text-white">
        {discountLabel(promo)}
      </span>
      <span className="text-xs text-slate-500 dark:text-slate-400">
        {copied ? "Nusxalandi!" : "Bosib nusxalang"}
      </span>
    </button>
  );
}
