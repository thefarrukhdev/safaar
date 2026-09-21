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
      className="group flex min-h-[44px] flex-col gap-1.5 rounded-xl border border-slate-900/[0.08] bg-slate-900/[0.05] p-4 text-left transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-900/[0.08] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-widest text-blue-700">
          <Ticket className="size-4" aria-hidden />
          {promo.code}
        </span>
        {copied ? (
          <Check className="size-4 text-emerald-600" aria-hidden />
        ) : (
          <Copy className="size-4 text-slate-900/70 group-hover:text-slate-900" aria-hidden />
        )}
      </div>
      <span className="text-lg font-semibold text-slate-900">
        {discountLabel(promo)}
      </span>
      <span className="text-xs text-slate-900/70">
        {copied ? "Nusxalandi!" : "Bosib nusxalang"}
      </span>
    </button>
  );
}
