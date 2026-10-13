"use client";

import { useState } from "react";
import { CheckCircle2, ShieldCheck, Banknote, CreditCard } from "lucide-react";
import { cn } from "@/lib/cn";
import { trackPaymentMethodSelected } from "@/lib/services/analytics/tracker";
import type { CheckoutDict } from "@/i18n/dictionaries";

export type PaymentMethodId = "uzcard" | "humo" | "visa" | "mastercard" | "cash";

export interface PaymentOptionConfig {
  id: PaymentMethodId;
  name: string;
  subtitle: string;
  badges: string[];
  logos?: { src: string; alt: string }[];
  colorTheme: {
    badgeBg: string;
    badgeText: string;
    borderSelected: string;
    bgSelected: string;
    iconBg: string;
  };
}

const CARD_THEME = {
  badgeBg: "bg-emerald-50 border-emerald-200",
  badgeText: "text-emerald-700",
  borderSelected: "border-emerald-500 ring-2 ring-emerald-500/20",
  bgSelected: "bg-emerald-50/40",
  iconBg: "bg-emerald-600 text-white",
};

const CASH_THEME = {
  badgeBg: "bg-amber-50 border-amber-200",
  badgeText: "text-amber-800",
  borderSelected: "border-amber-500 ring-2 ring-amber-500/20",
  bgSelected: "bg-amber-50/40",
  iconBg: "bg-amber-500 text-white",
};

export const CARD_IMAGE_MAP: Record<string, string> = {
  uzcard: "/payments/uzcard.jpg",
  humo: "/payments/humo.png",
  visa: "/payments/visa.jpeg",
  mastercard: "/payments/mastercard.jpg",
};

const TRANSPARENT_PAYMENT_OPTIONS: PaymentOptionConfig[] = [
  {
    id: "uzcard",
    name: "Uzcard / Humo",
    subtitle: "Milliy kartalar, 1.5% to'lov haqi",
    badges: ["1.5% to'lov haqi", "3D-Secure"],
    logos: [
      { src: CARD_IMAGE_MAP.uzcard, alt: "Uzcard" },
      { src: CARD_IMAGE_MAP.humo, alt: "Humo" },
    ],
    colorTheme: CARD_THEME,
  },
  {
    id: "visa",
    name: "Visa / Mastercard",
    subtitle: "Xalqaro kartalar, 3.5% to'lov haqi",
    badges: ["3.5% to'lov haqi", "3D-Secure"],
    logos: [
      { src: CARD_IMAGE_MAP.visa, alt: "Visa" },
      { src: CARD_IMAGE_MAP.mastercard, alt: "Mastercard" },
    ],
    colorTheme: CARD_THEME,
  },
  {
    id: "cash",
    name: "Joyida to'lash (Naqd)",
    subtitle: "Oldindan to'lov talab qilinmaydi, 0% to'lov haqi",
    badges: ["0% to'lov haqi"],
    logos: [],
    colorTheme: CASH_THEME,
  },
];

export interface PaymentSelectorProps {
  defaultValue?: PaymentMethodId;
  name?: string;
  onChange?: (value: PaymentMethodId) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dict?: CheckoutDict["paymentMethods"] | any;
  className?: string;
  /** Faqat shu ID'lar ko'rsatiladi (masalan retry oqimida faqat kartalarni ko'rsatish uchun). */
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

  const options = TRANSPARENT_PAYMENT_OPTIONS.filter((option) => {
    if (!allow) return true;
    if (option.id === "uzcard") {
      return allow.includes("uzcard") || allow.includes("humo");
    }
    if (option.id === "visa") {
      return allow.includes("visa") || allow.includes("mastercard");
    }
    return allow.includes(option.id);
  });

  const handleSelect = (id: PaymentMethodId) => {
    if (disabled) return;
    setSelected(id);
    trackPaymentMethodSelected({ paymentMethod: id });
    if (onChange) onChange(id);
  };

  const isOptionSelected = (optionId: PaymentMethodId) => {
    if (optionId === "uzcard") {
      return selected === "uzcard" || selected === "humo";
    }
    if (optionId === "visa") {
      return selected === "visa" || selected === "mastercard";
    }
    return selected === optionId;
  };

  return (
    <div className={cn("flex flex-col gap-3", className, disabled && "pointer-events-none opacity-60")}>
      <input type="hidden" name={name} value={selected} />

      <div className={cn("grid grid-cols-1 gap-3", options.length >= 3 ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
        {options.map((option) => {
          const isSelected = isOptionSelected(option.id);
          const nameText = option.id === "cash" && dict?.cash?.title ? dict.cash.title : option.name;
          const subtitleText = option.subtitle;
          const badges = option.badges ?? [];

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
                "group relative flex flex-col justify-between gap-3 cursor-pointer rounded-xl border p-4 transition-all duration-200 hover:shadow-md",
                isSelected
                  ? cn(option.colorTheme.borderSelected, option.colorTheme.bgSelected)
                  : "border-slate-200 bg-card hover:border-slate-300"
              )}
            >
              <div className="flex items-start justify-between w-full gap-3">
                <div className="flex items-start gap-3 w-full">
                  {/* Method Icon */}
                  <div
                    className={cn(
                      "flex shrink-0 items-center justify-center transition-transform duration-300 group-hover:scale-105 mt-0.5",
                      "h-9 w-9 rounded-xl shadow-sm",
                      option.colorTheme.iconBg
                    )}
                  >
                    {option.id !== "cash" ? (
                      <CreditCard className="h-5 w-5 stroke-[2.2]" />
                    ) : (
                      <Banknote className="h-5 w-5 stroke-[2.2]" />
                    )}
                  </div>

                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="font-bold text-slate-900 text-sm leading-snug">
                      {nameText}
                    </span>
                    {subtitleText && (
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {subtitleText}
                      </p>
                    )}

                    {badges.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {badges.map((badge, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] font-semibold",
                              option.colorTheme.badgeBg,
                              option.colorTheme.badgeText
                            )}
                          >
                            {badge.toLowerCase().includes("3d") && <ShieldCheck className="h-3 w-3" />}
                            {badge}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Logos */}
                    {option.logos && option.logos.length > 0 && (
                      <div className="mt-2 flex items-center flex-wrap gap-1.5">
                        {option.logos.map((card) => (
                          <div
                            key={card.alt}
                            className="flex h-6 w-9 items-center justify-center overflow-hidden rounded bg-white shadow-sm border border-slate-200/80"
                          >
                            <img
                              src={card.src}
                              alt={card.alt}
                              className="h-full w-full object-contain p-[1px] mix-blend-multiply"
                            />
                          </div>
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
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 bg-slate-50"
                    )}
                  >
                    {isSelected && <CheckCircle2 className="h-4 w-4 stroke-[3]" />}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
