"use client";

import { useTransition } from "react";
import { FluidDropdown } from "@/components/ui/FluidDropdown";
import { ThinkingOrb } from "@/components/ui/thinking-orb";
import { useCurrency } from "@/components/providers/CurrencyProvider";
import { CURRENCY_INFO, type CurrencyCode } from "@/lib/utils/money";

export function CurrencySwitcher({ light = false }: { light?: boolean }) {
  const { currency, setCurrency } = useCurrency();
  const [isPending, startTransition] = useTransition();

  function switchCurrency(nextCurrency: string) {
    if (nextCurrency === currency) return;
    startTransition(() => {
      setCurrency(nextCurrency as CurrencyCode);
    });
  }

  const items = (Object.keys(CURRENCY_INFO) as CurrencyCode[]).map((code) => {
    const info = CURRENCY_INFO[code];
    return {
      value: code,
      label: `${info.flag} ${info.code}`,
      description: info.symbol,
    };
  });

  return (
    <FluidDropdown
      value={currency}
      onChange={switchCurrency}
      items={items}
      triggerLabel={<span className="font-bold uppercase tracking-wide">{currency}</span>}
      icon={
        isPending ? (
          <ThinkingOrb size={16} state="base" />
        ) : (
          <span className="text-[16px] leading-none" aria-hidden>
            {CURRENCY_INFO[currency].symbol}
          </span>
        )
      }
      disabled={isPending}
      align="right"
      ariaLabel="Valyutani tanlash"
      menuClassName="w-48"
      buttonClassName="!h-10 min-h-[40px] px-3.5 text-[14px] font-bold gap-1.5 cursor-pointer backdrop-blur-md transition-all group-data-[transparent=true]/header:bg-white/15 group-data-[transparent=true]/header:text-white group-data-[transparent=true]/header:border-white/30 group-data-[transparent=true]/header:hover:bg-white/25 group-data-[transparent=true]/header:hover:border-white/40"
    />
  );
}
