"use client";

import { useCallback, useState } from "react";
import { PromoBar } from "./PromoBar";
import { useRealtimeEvent } from "@/lib/services/realtime/socket-provider";
import { getPromoBarConfig, type PromoBarConfig } from "@/lib/promo";

/**
 * `PromoBar`ning real-time o'rami: admin panelda promo-kod
 * qo'shilsa/tahrirlansa/o'chirilsa, sahifani yangilamasdan darhol
 * yangilanadi (`promos.updated` WebSocket hodisasi orqali).
 */
export function PromoBarLive({
  initialConfigs,
  locale,
}: {
  initialConfigs: PromoBarConfig[];
  locale: string;
}) {
  const [configs, setConfigs] = useState<PromoBarConfig[]>(initialConfigs);

  const refresh = useCallback(() => {
    getPromoBarConfig(locale)
      .then(setConfigs)
      .catch(() => {});
  }, [locale]);

  useRealtimeEvent("promos.updated", refresh, [refresh]);

  return <PromoBar configs={configs} locale={locale} />;
}
