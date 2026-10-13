"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useSocket } from "../_hooks/use-socket";
import { listingQueryKey } from "../_hooks/use-listing";
import { primaryHotelQueryKey } from "../_hooks/use-primary-hotel";
import { reservationsQueryKey } from "../_hooks/use-reservations";

/**
 * Backend `RealtimeGateway`sidan e'lon holati, bronlar va bildirishnomalar
 * haqidagi hodisalarni tinglaydi va tegishli react-query cache'larini
 * bekor qiladi hamda bildirishnoma (toast) chiqaradi.
 */
export function RealtimeListener() {
  const { on } = useSocket();
  const queryClient = useQueryClient();

  useEffect(() => {
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: listingQueryKey });
      void queryClient.invalidateQueries({ queryKey: primaryHotelQueryKey });
    };

    const offModerated = on("hotel.moderation_changed", (...args) => {
      const payload = args[0] as { status?: string } | undefined;
      refresh();
      if (payload?.status === "published") {
        toast.success("E'lon admin tomonidan tasdiqlandi va nashr qilindi");
      } else if (payload?.status === "rejected") {
        toast.error("E'lon admin tomonidan rad etildi");
      }
    });

    const offChanged = on("hotel.listing_changed", refresh);

    const offBookingStatus = on("booking.status_changed", (...args) => {
      const payload = args[0] as { message?: string; status?: string } | undefined;
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["partner", "dashboard"] });
      const msg = payload?.message || "Bron holati yangilandi";
      toast.info(msg);
    });

    const offDashboardUpdated = on("partner.dashboard_updated", () => {
      void queryClient.invalidateQueries({ queryKey: ["partner", "dashboard"] });
    });

    const offNotification = on("notification.created", (...args) => {
      const payload = args[0] as
        | { title?: string; message?: string; body?: string }
        | string
        | undefined;
      if (typeof payload === "string") {
        toast.info(payload);
      } else if (payload && typeof payload === "object") {
        const text = payload.message || payload.body || payload.title || "Yangi bildirishnoma";
        if (payload.title && (payload.message || payload.body)) {
          toast.info(payload.title, {
            description: payload.message || payload.body,
          });
        } else {
          toast.info(text);
        }
      } else {
        toast.info("Yangi bildirishnoma");
      }
    });

    return () => {
      offModerated?.();
      offChanged?.();
      offBookingStatus?.();
      offDashboardUpdated?.();
      offNotification?.();
    };
  }, [on, queryClient]);

  return null;
}
