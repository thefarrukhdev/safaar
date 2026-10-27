"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { pageItems, toRoomType } from "../_lib/api/adapters";
import { partners } from "../_lib/api";
import { useAuthStore } from "../_stores/auth-store";
import { type RoomTypeDraft } from "../_stores/data-store";
import { getPrimaryHotel } from "./use-primary-hotel";
import { formatUnitTypeName } from "../_lib/utils/partner-labels";

export const roomTypesQueryKey = ["partner", "room-types"] as const;

const EMPTY_ROOM_TYPES: ReturnType<typeof toRoomType>[] = [];

export function useRoomTypes() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const query = useQuery({
    queryKey: [...roomTypesQueryKey, partnerType],
    queryFn: async () => {
      const [hotel] = pageItems(await partners.listHotels(accessToken));
      if (!hotel) return [];
      return (await partners.listRoomTypes(hotel.id, accessToken))
        .map(toRoomType)
        .map((rt) => ({
          ...rt,
          name: formatUnitTypeName(rt.name, partnerType),
        }));
    },
    enabled: Boolean(accessToken),
  });

  return {
    data: query.data ?? EMPTY_ROOM_TYPES,
    isLoading: query.isLoading && !query.data,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

function roomTypeBody(values: RoomTypeDraft) {
  return {
    name: values.name,
    description: values.description,
    imageUrl: values.imageUrl,
    bedType: values.bedType,
    sizeSqm: values.sizeSqm,
    basePrice: values.basePrice,
    capacity: values.capacity,
    amenities: values.amenities,
  };
}

export function useCreateRoomType() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: RoomTypeDraft) => {
      const hotel = await getPrimaryHotel(accessToken);
      return toRoomType(
        await partners.createRoomType(hotel.id, roomTypeBody(values), accessToken),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roomTypesQueryKey });
    },
  });
}

export function useUpdateRoomType() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: RoomTypeDraft;
    }) => {
      const hotel = await getPrimaryHotel(accessToken);
      return toRoomType(
        await partners.updateRoomType(
          hotel.id,
          id,
          roomTypeBody(values),
          accessToken,
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roomTypesQueryKey });
    },
  });
}

export function useDeleteRoomType() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const hotel = await getPrimaryHotel(accessToken);
      const res = await partners.deleteRoomType(hotel.id, id, accessToken);
      if (!res.ok) {
        throw new Error(res.reason ?? "O'chirishda xatolik yuz berdi");
      }
      return res;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roomTypesQueryKey });
    },
  });
}
