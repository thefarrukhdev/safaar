"use client";

import { useQuery } from "@tanstack/react-query";
import { pageItems } from "../_lib/api/adapters";
import { partners } from "../_lib/api";
import { useAuthStore } from "../_stores/auth-store";

export const primaryHotelQueryKey = ["partner", "primary-hotel"] as const;

export async function getPrimaryHotel(token?: string | null) {
  let [hotel] = pageItems(await partners.listHotels(token));
  if (hotel && (hotel as unknown as Record<string, unknown>).partner_type) {
    const hotelPartnerType = String((hotel as unknown as Record<string, unknown>).partner_type);
    const currentUser = useAuthStore.getState().user;
    if (currentUser && currentUser.partnerType !== hotelPartnerType) {
      useAuthStore.getState().updateUser({ partnerType: hotelPartnerType });
    }
  }
  if (!hotel) {
    const user = useAuthStore.getState().user;
    const partnerType = user?.partnerType;
    if (partnerType && partnerType !== 'bus' && partnerType !== 'rent_car') {
      hotel = await partners.createHotel({ name: 'Yangi obyekt' }, token);
    }
  }
  return hotel;
}

export function usePrimaryHotel() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  return useQuery({
    queryKey: primaryHotelQueryKey,
    queryFn: () => getPrimaryHotel(accessToken),
    enabled: Boolean(accessToken),
  });
}
