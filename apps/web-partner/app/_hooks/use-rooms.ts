"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { usePrimaryHotel } from "./use-primary-hotel";
import { pageItems, toRoom } from "../_lib/api/adapters";
import { partners } from "../_lib/api";
import { useAuthStore } from "../_stores/auth-store";
import { type BulkRoomsDraft, type RoomDraft } from "../_stores/data-store";
import { getPrimaryHotel } from "./use-primary-hotel";
import { RoomStatus, type Room } from "../_lib/domain/types";

export const roomsQueryKey = ["partner", "rooms"] as const;

export interface RoomsQueryResult {
  allRooms: Room[];
  activeRooms: Room[];
}

const EMPTY_ROOMS: Room[] = [];

export function useRooms() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const query = useQuery({
    queryKey: roomsQueryKey,
    queryFn: async (): Promise<RoomsQueryResult> => {
      const [hotel] = pageItems(await partners.listHotels(accessToken));
      if (!hotel) return { allRooms: [], activeRooms: [] };
      const rawRooms = await partners.listRooms(hotel.id, accessToken);
      return {
        allRooms: rawRooms.map(toRoom),
        activeRooms: rawRooms.filter((r) => r.status !== "inactive").map(toRoom),
      };
    },
    enabled: Boolean(accessToken),
  });

  return { 
    data: query.data?.activeRooms ?? EMPTY_ROOMS, 
    allRooms: query.data?.allRooms ?? EMPTY_ROOMS,
    isLoading: query.isLoading && !query.data,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

function roomBody(values: Partial<RoomDraft>) {
  const body: Record<string, any> = {};
  if (values.number !== undefined) body.number = values.number;
  if (values.floor !== undefined) body.floor = values.floor;
  if (values.roomTypeId !== undefined) body.roomTypeId = values.roomTypeId;
  if (values.status !== undefined) body.status = values.status;
  if (values.isListed !== undefined) body.isListed = values.isListed;
  if (values.nightlyPrice !== undefined) body.nightlyPrice = values.nightlyPrice;
  return body;
}

export function useCreateRoom() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: RoomDraft) => {
      const hotel = await getPrimaryHotel(accessToken);
      return toRoom(await partners.createRoom(hotel.id, roomBody(values), accessToken));
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roomsQueryKey });
    },
  });
}

export function useUpdateRoom() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<RoomDraft> }) => {
      const hotel = await getPrimaryHotel(accessToken);
      return toRoom(
        await partners.updateRoom(hotel.id, id, roomBody(values), accessToken),
      );
    },
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: roomsQueryKey });
      const previousRooms = queryClient.getQueryData<RoomsQueryResult>(roomsQueryKey);
      if (previousRooms) {
        const updateRoomItem = (r: Room): Room => {
          if (r.id !== id) return r;
          return {
            ...r,
            ...(values.number !== undefined && { number: values.number }),
            ...(values.floor !== undefined && { floor: values.floor }),
            ...(values.roomTypeId !== undefined && { roomTypeId: values.roomTypeId }),
            ...(values.status !== undefined && { status: values.status }),
            ...(values.isListed !== undefined && { isListed: values.isListed }),
            ...(values.nightlyPrice !== undefined && { nightlyPrice: values.nightlyPrice }),
          };
        };

        queryClient.setQueryData<RoomsQueryResult>(roomsQueryKey, {
          allRooms: previousRooms.allRooms.map(updateRoomItem),
          activeRooms: previousRooms.activeRooms.map(updateRoomItem),
        });
      }
      return { previousRooms };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousRooms) {
        queryClient.setQueryData(roomsQueryKey, context.previousRooms);
      }
      toast.error(err?.message || "Xatolik yuz berdi");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: roomsQueryKey });
    },
  });
}

export function useToggleRoomStatus() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: RoomStatus }) => {
      const hotel = await getPrimaryHotel(accessToken);
      return toRoom(
        await partners.updateRoom(hotel.id, id, { status }, accessToken),
      );
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: roomsQueryKey });
      const previousRooms = queryClient.getQueryData<RoomsQueryResult>(roomsQueryKey);
      if (previousRooms) {
        const updateRoomItem = (r: Room): Room =>
          r.id === id ? { ...r, status } : r;
        queryClient.setQueryData<RoomsQueryResult>(roomsQueryKey, {
          allRooms: previousRooms.allRooms.map(updateRoomItem),
          activeRooms: previousRooms.activeRooms.map(updateRoomItem),
        });
      }
      return { previousRooms };
    },
    onError: (err: any, _vars, context) => {
      if (context?.previousRooms) {
        queryClient.setQueryData(roomsQueryKey, context.previousRooms);
      }
      toast.error(err?.message || "Xatolik yuz berdi");
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: roomsQueryKey });
    },
  });
}

export function useDeleteRoom() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const hotel = await getPrimaryHotel(accessToken);
      return partners.deleteRoom(hotel.id, id, accessToken);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roomsQueryKey });
    },
  });
}

export function useBulkCreateRooms() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: BulkRoomsDraft & { basePrice?: number; capacity?: number }) => {
      const hotel = await getPrimaryHotel(accessToken);
      return partners.bulkCreateRooms(
        hotel.id,
        {
          floor: values.floor,
          startNumber: values.startNumber,
          count: values.count,
          roomTypeId: values.roomTypeId,
          basePrice: values.basePrice,
          capacity: values.capacity,
        },
        accessToken,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roomsQueryKey });
    },
  });
}

export function useAddRoomPhoto() {
  const qc = useQueryClient();
  const { data: hotel } = usePrimaryHotel();
  const hotelId = hotel?.id;
  const token = useAuthStore((s) => s.tokens?.accessToken);

  return useMutation({
    mutationFn: async ({ roomId, fileId }: { roomId: string; fileId: string }) => {
      if (!hotelId) throw new Error('Hotel ID not found');
      return partners.addRoomImage(hotelId, roomId, { file_id: fileId }, token);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', hotelId] });
    },
  });
}

export function useDeleteRoomPhoto() {
  const qc = useQueryClient();
  const { data: hotel } = usePrimaryHotel();
  const hotelId = hotel?.id;
  const token = useAuthStore((s) => s.tokens?.accessToken);

  return useMutation({
    mutationFn: async ({ roomId, imageId }: { roomId: string; imageId: string }) => {
      if (!hotelId) throw new Error('Hotel ID not found');
      return partners.deleteRoomImage(hotelId, roomId, imageId, token);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', hotelId] });
    },
  });
}

export function useUpdateRoomPhoto() {
  const qc = useQueryClient();
  const { data: hotel } = usePrimaryHotel();
  const hotelId = hotel?.id;
  const token = useAuthStore((s) => s.tokens?.accessToken);

  return useMutation({
    mutationFn: async ({ roomId, imageId, values }: { roomId: string; imageId: string; values: Record<string, unknown> }) => {
      if (!hotelId) throw new Error('Hotel ID not found');
      return partners.updateRoomImage(hotelId, roomId, imageId, values, token);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms', hotelId] });
    },
  });
}
