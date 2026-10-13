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

/** Standart checkout uchun 2 ta aniq va moslashuvchan variant: Karta va Joyida to'lash */
export const CHECKOUT_PAYMENT_OPTIONS: PaymentOptionConfig[] = [
  {
    id: "uzcard",
    name: "Karta orqali to'lash",
    subtitle: "Uzcard, Humo, Visa, Mastercard",
    badges: ["3D-Secure", "Onlayn to'lov"],
    logos: [
      { src: CARD_IMAGE_MAP.uzcard, alt: "Uzcard" },
      { src: CARD_IMAGE_MAP.humo, alt: "Humo" },
      { src: CARD_IMAGE_MAP.visa, alt: "Visa" },
      { src: CARD_IMAGE_MAP.mastercard, alt: "Mastercard" },
    ],
    colorTheme: CARD_THEME,
  },
  {
    id: "cash",
    name: "Joyida to'lash (Naqd)",
    subtitle: "Oldindan to'lov talab qilinmaydi, 0% to'lov haqi",
    badges: ["0% to'lov haqi", "Oldindan to'lovsiz"],
    logos: [],
    colorTheme: CASH_THEME,
  },
];

/** Qayta to'lash (Retry) oqimi uchun batafsil variantlar */
export const GRANULAR_PAYMENT_OPTIONS: PaymentOptionConfig[] = [
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

  // Agar faqat kartalar ruxsat etilgan bo'lsa (masalan RetryForm), granular kartalar ko'rsatiladi.
  // Default checkout'da esa aynan foydalanuvchi so'raganidek 2 ta variant: Karta va Naqd.
  const isGranular = Boolean(
    allow &&
      (allow.includes("visa") ||
        allow.includes("mastercard") ||
        allow.includes("humo")) &&
      !allow.includes("cash")
  );

  const baseOptions = isGranular ? GRANULAR_PAYMENT_OPTIONS : CHECKOUT_PAYMENT_OPTIONS;

  const options = baseOptions.filter((option) => {
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

      <div
        className={cn(
          "grid grid-cols-1 gap-3 sm:gap-4",
          options.length === 2 ? "sm:grid-cols-2" : options.length >= 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"
        )}
      >
        {options.map((option) => {
          const isSelected = isOptionSelected(option.id);
          
          let nameText = option.name;
          let subtitleText = option.subtitle;
          
          if (option.id === "cash") {
            if (dict?.cash?.title) nameText = dict.cash.title;
            if (dict?.cash?.desc) subtitleText = dict.cash.desc;
          } else if (!isGranular && option.id === "uzcard") {
            if (dict?.local_card?.title) nameText = dict.local_card.title;
            if (dict?.local_card?.desc) subtitleText = dict.local_card.desc;
          } else if (isGranular) {
            if (option.id === "visa" && dict?.intl_card?.title) nameText = dict.intl_card.title;
          }
          const badges: string[] = (
            (option.id === "cash" && Array.isArray(dict?.cash?.badges) && dict.cash.badges.length > 0)
              ? (dict.cash.badges as string[])
              : (!isGranular && option.id === "uzcard" && Array.isArray(dict?.local_card?.badges) && dict.local_card.badges.length > 0)
              ? (dict.local_card.badges as string[])
              : (isGranular && option.id === "visa" && Array.isArray(dict?.intl_card?.badges) && dict.intl_card.badges.length > 0)
              ? (dict.intl_card.badges as string[])
              : option.badges
          ) ?? [];

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
                "group relative flex flex-col justify-between gap-3 sm:gap-4 cursor-pointer rounded-2xl border p-4 sm:p-5 transition-all duration-200 hover:shadow-md active:scale-[0.99] touch-manipulation select-none",
                isSelected
                  ? cn(option.colorTheme.borderSelected, option.colorTheme.bgSelected)
                  : "border-slate-200 bg-white hover:border-slate-300 shadow-2xs"
              )}
            >
              <div className="flex items-start justify-between w-full gap-3">
                <div className="flex items-start gap-3 sm:gap-3.5 w-full min-w-0">
                  {/* Method Icon */}
                  <div
                    className={cn(
                      "flex shrink-0 items-center justify-center transition-transform duration-300 group-hover:scale-105 mt-0.5",
                      "h-10 w-10 sm:h-11 sm:w-11 rounded-xl shadow-xs",
                      option.colorTheme.iconBg
                    )}
                  >
                    {option.id !== "cash" ? (
                      <CreditCard className="h-5 w-5 sm:h-5.5 sm:w-5.5 stroke-[2.2]" />
                    ) : (
                      <Banknote className="h-5 w-5 sm:h-5.5 sm:w-5.5 stroke-[2.2]" />
                    )}
                  </div>

                  <div className="flex flex-col gap-1 flex-1 min-w-0">
                    <span className="font-bold text-slate-900 text-sm sm:text-base leading-snug">
                      {nameText}
                    </span>
                    {subtitleText && (
                      <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                        {subtitleText}
                      </p>
                    )}

                    {badges.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {badges.map((badge, i) => (
                          <span
                            key={i}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10px] sm:text-xs font-semibold",
                              option.colorTheme.badgeBg,
                              option.colorTheme.badgeText
                            )}
                          >
                            {badge.toLowerCase().includes("3d") && <ShieldCheck className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
                            {badge}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Logos */}
                    {option.logos && option.logos.length > 0 && (
                      <div className="mt-2.5 flex items-center flex-wrap gap-1.5 sm:gap-2">
                        {option.logos.map((card) => (
                          <div
                            key={card.alt}
                            className="flex h-6 w-9 sm:h-7 sm:w-10 items-center justify-center overflow-hidden rounded-md bg-white shadow-2xs border border-slate-200/90"
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
                <div className="flex h-5 w-5 sm:h-6 sm:w-6 shrink-0 items-center justify-center pt-0.5">
                  <div
                    className={cn(
                      "flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full border transition-all",
                      isSelected
                        ? "border-blue-600 bg-blue-600 text-white shadow-xs"
                        : "border-slate-300 bg-slate-50"
                    )}
                  >
                    {isSelected && <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3]" />}
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
