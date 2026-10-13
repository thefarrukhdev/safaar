"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toBed } from "../_lib/api/adapters";
import { partners } from "../_lib/api";
import { useAuthStore } from "../_stores/auth-store";
import { type BedDraft } from "../_stores/data-store";
import { getPrimaryHotel } from "./use-primary-hotel";
import { hasBeds } from "../_lib/utils/partner-labels";

export const bedsQueryKey = ["partner", "beds"] as const;

const EMPTY_BEDS: ReturnType<typeof toBed>[] = [];

export function useBeds() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const query = useQuery({
    queryKey: bedsQueryKey,
    queryFn: async () => {
      const hotel = await getPrimaryHotel(accessToken);
      return (await partners.listBeds(hotel.id, accessToken)).map(toBed);
    },
    enabled: Boolean(accessToken) && hasBeds(partnerType),
  });

  return {
    data: query.data ?? EMPTY_BEDS,
    isLoading: query.isLoading && !query.data,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateBed() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: BedDraft) => {
      const hotel = await getPrimaryHotel(accessToken);
      return toBed(
        await partners.createBed(
          hotel.id,
          values.roomId,
          {
            label: values.label,
            status: values.status,
            isListed: values.isListed,
            nightlyPrice: values.nightlyPrice,
          },
          accessToken,
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bedsQueryKey });
    },
  });
}

export function useUpdateBed() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Partial<Omit<BedDraft, "roomId">>;
    }) => {
      const hotel = await getPrimaryHotel(accessToken);
      return toBed(await partners.updateBed(hotel.id, id, values, accessToken));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bedsQueryKey });
    },
  });
}

export function useDeleteBed() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const hotel = await getPrimaryHotel(accessToken);
      return partners.deleteBed(hotel.id, id, accessToken);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bedsQueryKey });
    },
  });
}

export function useGenerateBeds() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ roomId, count }: { roomId: string; count: number }) => {
      const hotel = await getPrimaryHotel(accessToken);
      return partners.generateBeds(hotel.id, roomId, count, accessToken);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: bedsQueryKey });
    },
  });
}
