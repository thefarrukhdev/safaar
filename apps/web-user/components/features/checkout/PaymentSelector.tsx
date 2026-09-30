"use client";

import { useState } from "react";
import { CheckCircle2, ShieldCheck, Zap, Banknote, CreditCard, Smartphone } from "lucide-react";
import { cn } from "@/lib/cn";
import { trackPaymentMethodSelected } from "@/lib/services/analytics/tracker";
import type { CheckoutDict } from "@/i18n/dictionaries";

// `humo`/`uzcard`/`visa`/`mastercard` — backend'da barchasi to'lov shlyuzi
// orqali (bitta texnik transport) ishlaydi; karta turi FEE stavkasini
// belgilaydi (1.5% / 3.5%). Qarang docs/frontend-payment-integration.md.
//
// `id` HAR DOIM haqiqiy `PaymentMethodId` bo'lishi shart — backend
// `payment_method`ni `@IsIn(['click','payme','uzcard','humo','visa',
// 'mastercard','cash'])` bilan qat'iy tekshiradi (bookings/dto/booking.dto.ts),
// umumiy "card" qiymati 400 bilan rad etiladi. Quyidagi bitta "karta" UI
// varianti (barcha 4 tarmoqni bitta plitkada ko'rsatadi) shu sabab haqiqiy
// submit qiymati sifatida "uzcard"ni ishlatadi, generic "card"ni emas.
export type PaymentMethodId = "uzcard" | "humo" | "visa" | "mastercard" | "cash";

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
  badgeBg: "bg-emerald-50  border-emerald-200 ",
  badgeText: "text-emerald-700 ",
  borderSelected: "border-emerald-500 ring-2 ring-emerald-500/20",
  bgSelected: "bg-emerald-50/40 ",
  iconBg: "bg-emerald-600 text-white",
};

const PAYMENT_OPTIONS: PaymentMethodConfig[] = [
  {
    id: "uzcard",
    name: "Karta orqali to'lash",
    subtitle: "Uzcard, Humo, Visa va Mastercard",
    badges: [],
    type: "local_card",
    dictKey: "local_card" as any,
    colorTheme: CARD_THEME,
  },
  {
    id: "cash",
    dictKey: "cash" as any,
    type: "cash",
    colorTheme: {
      badgeBg: "bg-amber-50  border-amber-200 ",
      badgeText: "text-amber-800 ",
      borderSelected: "border-amber-500 ring-2 ring-amber-500/20",
      bgSelected: "bg-amber-50/40 ",
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
                "group relative flex flex-col gap-3 cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md",
                isSelected
                  ? cn(option.colorTheme.borderSelected, option.colorTheme.bgSelected)
                  : "border-slate-200 bg-card hover:border-slate-300   :border-slate-700"
              )}
            >
              <div className="flex items-start justify-between w-full gap-3">
                <div className="flex items-start gap-3.5 w-full">
                  {/* Method Icon */}
                  <div
                    className={cn(
                      "flex shrink-0 items-center justify-center transition-transform duration-300 group-hover:scale-105 mt-0.5",
                      "h-9 w-9 rounded-xl shadow-sm",
                      option.colorTheme.iconBg
                    )}
                  >
                    {(option.type === "local_card" || option.type === "intl_card") && <CreditCard className="h-5 w-5 stroke-[2.2]" />}
                    {option.id === "cash" && <Banknote className="h-5 w-5 stroke-[2.2]" />}
                  </div>

                  <div className="flex flex-col gap-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900 ">
                        {nameText}
                      </span>
                    </div>
                    {subtitleText && (
                      <p className="text-xs text-slate-500 ">
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
                            {badge.includes("xavfsizlik") && <ShieldCheck className="h-3 w-3" />}
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
                        ? "border-primary-600 bg-primary-600 text-white  "
                        : "border-slate-300 bg-slate-50  "
                    )}
                  >
                    {isSelected && <CheckCircle2 className="h-4 w-4 stroke-[3]" />}
                  </div>
                </div>
              </div>

              {/* Extras (Logos) below the text */}
              {option.type === "local_card" && (
                <div className="flex items-center flex-wrap gap-2 ml-[50px]">
                  <div className="flex h-6 w-9 items-center justify-center overflow-hidden rounded bg-white shadow-sm border border-slate-200/70 ">
                    <img src="/payments/uzcard.jpg" alt="Uzcard" className="h-full w-full object-contain p-[2px] mix-blend-multiply " />
                  </div>
                  <div className="flex h-6 w-9 items-center justify-center overflow-hidden rounded bg-white shadow-sm border border-slate-200/70 ">
                    <img src="/payments/humo.png" alt="Humo" className="h-full w-full object-contain p-[2px] mix-blend-multiply " />
                  </div>
                  <div className="flex h-6 w-9 items-center justify-center overflow-hidden rounded bg-white shadow-sm border border-slate-200/70 ">
                    <img src="/payments/visa.jpeg" alt="Visa" className="h-full w-full object-contain p-[2px] mix-blend-multiply " />
                  </div>
                  <div className="flex h-6 w-9 items-center justify-center overflow-hidden rounded bg-white shadow-sm border border-slate-200/70 ">
                    <img src="/payments/mastercard.jpg" alt="Mastercard" className="h-full w-full object-contain p-[2px] mix-blend-multiply " />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
