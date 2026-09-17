"use client";

import { useState } from "react";
import { CheckCircle2, ShieldCheck, Zap, Banknote, CreditCard, Smartphone } from "lucide-react";
import { cn } from "@/lib/cn";
import { trackPaymentMethodSelected } from "@/lib/services/analytics/tracker";

// `humo`/`uzcard`/`visa`/`mastercard` — backend'da barchasi Uzum Checkout
// orqali (bitta texnik transport) ishlaydi; karta turi FEE stavkasini
// belgilaydi (1.5% / 3.5%). Qarang docs/frontend-payment-integration.md.
export type PaymentMethodId =
  | "click"
  | "payme"
  | "uzcard"
  | "humo"
  | "visa"
  | "mastercard"
  | "cash";

export interface PaymentOption {
  id: PaymentMethodId;
  name: string;
  subtitle: string;
  badges: string[];
  type: "online" | "card" | "cash";
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
const PAYMENT_OPTIONS: PaymentOption[] = [
  {
    id: "click",
    name: "Click Pass / Evolution",
    subtitle: "Click Evolution ilovasi yoki *880# USSD orqali zudlik bilan to'lash",
    badges: ["1-click to'lov", "Instant confirmation"],
    type: "online",
    colorTheme: {
      badgeBg: "bg-primary-50 dark:bg-primary-950/60 border-primary-200 dark:border-primary-800",
      badgeText: "text-primary-700 dark:text-primary-300",
      borderSelected: "border-primary-500 ring-2 ring-primary-500/20",
      bgSelected: "bg-primary-50/40 dark:bg-primary-950/20",
      iconBg: "bg-primary-600 text-white",
    },
  },
  {
    id: "payme",
    name: "Payme",
    subtitle: "Payme ilovasi yoki rasmiy sayti orqali xavfsiz va tezkor to'lov",
    badges: ["0% komissiya", "Zudlik bilan tasdiqlash"],
    type: "online",
    colorTheme: {
      badgeBg: "bg-cyan-50 dark:bg-cyan-950/60 border-cyan-200 dark:border-cyan-800",
      badgeText: "text-cyan-700 dark:text-cyan-300",
      borderSelected: "border-cyan-500 ring-2 ring-cyan-500/20",
      bgSelected: "bg-cyan-50/40 dark:bg-cyan-950/20",
      iconBg: "bg-cyan-500 text-white",
    },
  },
  {
    id: "uzcard",
    name: "Uzcard",
    subtitle: "Uzcard milliy plastik kartasi orqali to'g'ridan-to'g'ri to'lov (Uzum Checkout)",
    badges: ["3D-Secure xavfsizlik", "To'lov haqi: 1.5%"],
    type: "card",
    colorTheme: CARD_THEME,
  },
  {
    id: "humo",
    name: "Humo",
    subtitle: "Humo milliy plastik kartasi orqali to'g'ridan-to'g'ri to'lov (Uzum Checkout)",
    badges: ["3D-Secure xavfsizlik", "To'lov haqi: 1.5%"],
    type: "card",
    colorTheme: CARD_THEME,
  },
  {
    id: "visa",
    name: "Visa",
    subtitle: "Xalqaro Visa kartasi orqali to'lov (Uzum Checkout)",
    badges: ["3D-Secure xavfsizlik", "To'lov haqi: 3.5%"],
    type: "card",
    colorTheme: INTL_CARD_THEME,
  },
  {
    id: "mastercard",
    name: "Mastercard",
    subtitle: "Xalqaro Mastercard kartasi orqali to'lov (Uzum Checkout)",
    badges: ["3D-Secure xavfsizlik", "To'lov haqi: 3.5%"],
    type: "card",
    colorTheme: INTL_CARD_THEME,
  },
  {
    id: "cash",
    name: "Joyida to'lash (Naqd / Terminal)",
    subtitle: "Oldindan to'lov talab qilinmaydi. Mehmonxonaga kelganda qabulxonada to'lanadi",
    badges: ["Oldindan to'lovsiz", "Moslashuvchan bekor qilish"],
    type: "cash",
    colorTheme: {
      badgeBg: "bg-amber-50 dark:bg-amber-950/60 border-amber-200 dark:border-amber-800",
      badgeText: "text-amber-800 dark:text-amber-300",
      borderSelected: "border-amber-500 ring-2 ring-amber-500/20",
      bgSelected: "bg-amber-50/40 dark:bg-amber-950/20",
      iconBg: "bg-amber-500 text-white",
    },
  },
];

export interface PaymentSelectorProps {
  defaultValue?: PaymentMethodId;
  name?: string;
  onChange?: (value: PaymentMethodId) => void;
  dict?: Record<string, string>;
  className?: string;
  /** Faqat shu ID'lar ko'rsatiladi (masalan retry oqimida "cash"ni yashirish uchun). */
  allow?: PaymentMethodId[];
  disabled?: boolean;
}

export function PaymentSelector({
  defaultValue = "click",
  name = "paymentMethod",
  onChange,
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
                "group relative flex cursor-pointer items-start justify-between rounded-2xl border p-4 transition-all duration-200 hover:shadow-md",
                isSelected
                  ? cn(option.colorTheme.borderSelected, option.colorTheme.bgSelected)
                  : "border-slate-200 bg-card hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/80 dark:hover:border-slate-700"
              )}
            >
              <div className="flex items-start gap-3.5">
                {/* Method Icon / Logo Badge */}
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-bold shadow-xs transition-transform duration-200 group-hover:scale-105",
                    option.colorTheme.iconBg
                  )}
                >
                  {option.id === "click" && <Smartphone className="h-5 w-5 stroke-[2.2]" />}
                  {option.id === "payme" && <Zap className="h-5 w-5 stroke-[2.2]" />}
                  {(option.id === "uzcard" || option.id === "humo" || option.id === "visa" || option.id === "mastercard") && (
                    <CreditCard className="h-5 w-5 stroke-[2.2]" />
                  )}
                  {option.id === "cash" && <Banknote className="h-5 w-5 stroke-[2.2]" />}
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900 dark:text-white">
                      {option.name}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {option.subtitle}
                  </p>

                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {option.badges.map((badge, i) => (
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
