"use client";

import React, { createContext, useContext, useState, useCallback } from "react";
import { type CurrencyCode, formatMoney, DEFAULT_EXCHANGE_RATES } from "@/lib/utils/money";
import { setCurrencyCookie } from "@/app/actions/currency";
import { useRouter } from "next/navigation";

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  formatPrice: (amountInSum: number, locale?: string) => string;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export function CurrencyProvider({
  children,
  initialCurrency,
}: {
  children: React.ReactNode;
  initialCurrency: CurrencyCode;
}) {
  const [currency, setCurrencyState] = useState<CurrencyCode>(initialCurrency);
  const router = useRouter();

  const setCurrency = useCallback(
    (newCurrency: CurrencyCode) => {
      setCurrencyState(newCurrency);
      setCurrencyCookie(newCurrency).then(() => {
        router.refresh(); // Refresh server components to pick up new cookie
      });
    },
    [router]
  );

  const formatPrice = useCallback(
    (amountInSum: number, locale: string = "uz") => {
      return formatMoney(amountInSum, currency, DEFAULT_EXCHANGE_RATES, locale);
    },
    [currency]
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, formatPrice }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error("useCurrency must be used within a CurrencyProvider");
  }
  return context;
}
