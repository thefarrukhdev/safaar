"use client";

import { useState } from "react";
import { CheckCircle2, ShieldCheck, Zap, Banknote, CreditCard, Smartphone } from "lucide-react";
import { cn } from "@/lib/cn";
import { trackPaymentMethodSelected } from "@/lib/services/analytics/tracker";
import type { CheckoutDict } from "@/i18n/dictionaries";

// `humo`/`uzcard`/`visa`/`mastercard` — backend'da barchasi Uzum Checkout
// orqali (bitta texnik transport) ishlaydi; karta turi FEE stavkasini
// belgilaydi (1.5% / 3.5%). Qarang docs/frontend-payment-integration.md.
export type PaymentMethodId =
  | "uzcard"
  | "humo"
  | "visa"
  | "mastercard"
  | "cash";

export interface PaymentMethodConfig {
  id: PaymentMethodId;
  dictKey?: "card" | "cash";
  type: "online" | "card" | "local_card" | "intl_card" | "cash";
  name?: string;
  subtitle?: string;
  badges?: string[];
  colorTheme: {
    badgeBg: string;
    badgeText: string;
    borderSelected: string;
    bgSelected: string;
    iconBg: string;
  };
}

const CARD_THEME = {
  badgeBg: "bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800",
  badgeText: "text-emerald-700 dark:text-emerald-300",
  borderSelected: "border-emerald-500 ring-2 ring-emerald-500/20",
  bgSelected: "bg-emerald-50/40 dark:bg-emerald-950/20",
  iconBg: "bg-emerald-600 text-white",
};

const INTL_CARD_THEME = {
  badgeBg: "bg-indigo-50 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800",
  badgeText: "text-indigo-700 dark:text-indigo-300",
  borderSelected: "border-indigo-500 ring-2 ring-indigo-500/20",
  bgSelected: "bg-indigo-50/40 dark:bg-indigo-950/20",
  iconBg: "bg-indigo-600 text-white",
};

// Fee stavkalari — mahsulot talabi bo'yicha tasdiqlangan, backend'dagi
// `card-scheme-fee.ts`dagi bilan BIR XIL (2026-09-16). Bu yerda FAQAT
// informativ belgi (badge) sifatida ko'rsatiladi — yakuniy summa hech
// qachon shu qiymatdan frontendda HISOBLANMAYDI, backend qaytargan
// haqiqiy `fee_amount`/`amount` ishlatiladi (checkout sahifasida).
const PAYMENT_OPTIONS: PaymentMethodConfig[] = [
  {
    id: "uzcard",
    name: "Milliy kartalar orqali to'lash",
    subtitle: "Uzum Checkout orqali (Uzcard, Humo)",
    badges: ["3D-Secure xavfsizlik"],
    type: "local_card",
    colorTheme: CARD_THEME,
  },
  {
    id: "visa",
    name: "Xalqaro kartalar orqali to'lash",
    subtitle: "Visa, Mastercard orqali xavfsiz to'lov",
    badges: ["3D-Secure xavfsizlik"],
    type: "intl_card",
    colorTheme: INTL_CARD_THEME,
  },
  {
    id: "cash",
    dictKey: "cash",
    type: "cash",
    colorTheme: {
      badgeBg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800",
      badgeText: "text-amber-800 dark:text-amber-300",
      borderSelected: "border-amber-500 ring-2 ring-amber-500/20",
      bgSelected: "bg-amber-50/40 dark:bg-amber-950/20",
      iconBg: "bg-amber-500 text-white",
    },
  },
] as const;

export interface PaymentSelectorProps {
  defaultValue?: PaymentMethodId;
  name?: string;
  onChange?: (value: PaymentMethodId) => void;
  dict?: CheckoutDict["paymentMethods"];
  className?: string;
  /** Faqat shu ID'lar ko'rsatiladi (masalan retry oqimida "cash"ni yashirish uchun). */
  allow?: PaymentMethodId[];
  disabled?: boolean;
}

export function PaymentSelector({
  defaultValue = "uzcard",
  name = "paymentMethod",
  onChange,
  dict,
  className,
  allow,
  disabled = false,
}: PaymentSelectorProps) {
  const [selected, setSelected] = useState<PaymentMethodId>(defaultValue);
  const options = allow
    ? PAYMENT_OPTIONS.filter((option) => allow.includes(option.id))
    : PAYMENT_OPTIONS;

  const handleSelect = (id: PaymentMethodId) => {
    if (disabled) return;
    setSelected(id);
    trackPaymentMethodSelected({ paymentMethod: id });
    if (onChange) onChange(id);
  };

  return (
    <div className={cn("flex flex-col gap-3", className, disabled && "pointer-events-none opacity-60")}>
      <input type="hidden" name={name} value={selected} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {options.map((option) => {
          const isSelected = selected === option.id;
          const methodInfo: CheckoutDict["paymentMethods"][keyof CheckoutDict["paymentMethods"]] | undefined =
            option.dictKey ? dict?.[option.dictKey] : undefined;
          const nameText = methodInfo?.title ?? option.name ?? option.dictKey ?? option.id;
          const subtitleText = methodInfo?.desc ?? option.subtitle ?? "";
          const badges: string[] = methodInfo?.badges ?? option.badges ?? [];

          return (
            <div
              key={option.id}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={disabled || undefined}
              tabIndex={disabled ? -1 : 0}
              onClick={() => handleSelect(option.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect(option.id);
                }
              }}
              className={cn(
                "group relative flex cursor-pointer items-start justify-between rounded-xl border p-4 transition-all duration-200 hover:shadow-md",
                isSelected
                  ? cn(option.colorTheme.borderSelected, option.colorTheme.bgSelected)
                  : "border-slate-200 bg-card hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700"
              )}
            >
              <div className="flex items-start gap-3.5">
                {/* Method Icon / Logo Badge */}
                <div
                  className={cn(
                    "flex shrink-0 overflow-hidden items-center justify-center font-bold transition-transform duration-200 group-hover:scale-105",
                    option.type === "local_card" || option.type === "intl_card"
                      ? "gap-1 flex-wrap w-fit max-w-[88px]" // Ensure it fits the images
                      : cn("h-10 w-10 rounded-xl shadow-xs", option.colorTheme.iconBg)
                  )}
                >
                  {option.type === "local_card" && (
                    <>
                      <div className="h-6 w-9 rounded border border-slate-200 dark:border-slate-700 bg-white shadow-xs overflow-hidden">
                        <img src="/payments/uzcard.jpg" alt="Uzcard" className="h-full w-full object-contain p-0.5" />
                      </div>
                      <div className="h-6 w-9 rounded border border-slate-200 dark:border-slate-700 bg-white shadow-xs overflow-hidden">
                        <img src="/payments/humo.png" alt="Humo" className="h-full w-full object-contain p-0.5" />
                      </div>
                    </>
                  )}
                  {option.type === "intl_card" && (
                    <>
                      <div className="h-6 w-9 rounded border border-slate-200 dark:border-slate-700 bg-white shadow-xs overflow-hidden">
                        <img src="/payments/visa.jpeg" alt="Visa" className="h-full w-full object-contain p-0.5" />
                      </div>
                      <div className="h-6 w-9 rounded border border-slate-200 dark:border-slate-700 bg-white shadow-xs overflow-hidden">
                        <img src="/payments/mastercard.jpg" alt="Mastercard" className="h-full w-full object-contain p-0.5" />
                      </div>
                    </>
                  )}
                  {option.id === "cash" && <Banknote className="h-5 w-5 stroke-[2.2]" />}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {nameText}
                    </span>
                  </div>
                  {subtitleText && (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {subtitleText}
                    </p>
                  )}

                  {badges.length > 0 && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      {badges.map((badge: string, i: number) => (
                        <span
                          key={i}
                          className={cn(
                            "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[11px] font-semibold",
                            option.colorTheme.badgeBg,
                            option.colorTheme.badgeText
                          )}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          {badge}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Radio Circle indicator */}
              <div className="flex h-5 w-5 shrink-0 items-center justify-center pt-0.5">
                <div
                  className={cn(
                    "flex h-5 w-5 items-center justify-center rounded-full border transition-all",
                    isSelected
                      ? "border-primary-600 bg-primary-600 text-white dark:border-primary-500 dark:bg-primary-500"
                      : "border-slate-300 bg-slate-50 dark:border-slate-600 dark:bg-slate-800"
                  )}
                >
                  {isSelected && <CheckCircle2 className="h-4 w-4 stroke-[3]" />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
