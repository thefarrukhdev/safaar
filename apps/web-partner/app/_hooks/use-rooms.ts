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
import { formatUnitTypeName } from "../_lib/utils/partner-labels";

export const roomsQueryKey = ["partner", "rooms"] as const;

export interface RoomsQueryResult {
  allRooms: Room[];
  activeRooms: Room[];
}

const EMPTY_ROOMS: Room[] = [];

export function useRooms() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const query = useQuery({
    queryKey: [...roomsQueryKey, partnerType],
    queryFn: async (): Promise<RoomsQueryResult> => {
      const [hotel] = pageItems(await partners.listHotels(accessToken));
      if (!hotel) return { allRooms: [], activeRooms: [] };
      const rawRooms = await partners.listRooms(hotel.id, accessToken);
      const all = rawRooms.map(toRoom).map((r) => ({
        ...r,
        roomTypeName: formatUnitTypeName(r.roomTypeName, partnerType),
      }));
      const active = rawRooms
        .filter((r) => r.status !== "inactive")
        .map(toRoom)
        .map((r) => ({
          ...r,
          roomTypeName: formatUnitTypeName(r.roomTypeName, partnerType),
        }));
      return {
        allRooms: all,
        activeRooms: active,
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

function roomBody(values: Omit<Partial<RoomDraft>, "status"> & { status?: RoomStatus | string }) {
  const body: Record<string, unknown> = {};
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
    mutationFn: async ({
      id,
      values,
    }: {
      id: string;
      values: Omit<Partial<RoomDraft>, "status"> & { status?: RoomStatus | string; _rawStatus?: string };
    }) => {
      const hotel = await getPrimaryHotel(accessToken);
      return toRoom(
        await partners.updateRoom(hotel.id, id, roomBody(values), accessToken),
      );
    },
    onMutate: async ({ id, values }) => {
      await queryClient.cancelQueries({ queryKey: roomsQueryKey });
      const previousRooms = queryClient.getQueryData<RoomsQueryResult>(roomsQueryKey);
      if (previousRooms) {
        const statusStr = values.status as string | undefined;
        const isRawStatus = statusStr === 'active' || statusStr === 'inactive';
        const updateRoomItem = (r: Room): Room => {
          if (r.id !== id) return r;
          return {
            ...r,
            ...(values.number !== undefined && { number: values.number }),
            ...(values.floor !== undefined && { floor: values.floor }),
            ...(values.roomTypeId !== undefined && { roomTypeId: values.roomTypeId }),
            ...(values.status !== undefined && {
              status: isRawStatus ? r.status : (values.status as RoomStatus),
              ...(isRawStatus ? { _rawStatus: values.status } : {}),
            }),
            ...(values.isListed !== undefined && {
              isListed: values.isListed,
              _rawStatus: values.isListed ? 'active' : 'inactive',
            }),
            ...(values.nightlyPrice !== undefined && { nightlyPrice: values.nightlyPrice }),
            ...((values as { _rawStatus?: string })._rawStatus !== undefined && {
              _rawStatus: (values as { _rawStatus?: string })._rawStatus,
            }),
          };
        };

        const updatedAllRooms = previousRooms.allRooms.map(updateRoomItem);
        const updatedTarget = updatedAllRooms.find((r) => r.id === id);

        const isBecomingInactive =
          statusStr === 'inactive' ||
          (values as { _rawStatus?: string })._rawStatus === 'inactive' ||
          values.isListed === false;

        const isBecomingActive =
          statusStr === 'active' ||
          (values as { _rawStatus?: string })._rawStatus === 'active' ||
          values.isListed === true;

        let updatedActiveRooms: Room[];
        if (isBecomingInactive) {
          updatedActiveRooms = previousRooms.activeRooms.filter((r) => r.id !== id);
        } else if (isBecomingActive) {
          const exists = previousRooms.activeRooms.some((r) => r.id === id);
          if (exists) {
            updatedActiveRooms = previousRooms.activeRooms.map(updateRoomItem);
          } else if (updatedTarget) {
            updatedActiveRooms = [...previousRooms.activeRooms, updatedTarget];
          } else {
            updatedActiveRooms = previousRooms.activeRooms;
          }
        } else {
          updatedActiveRooms = previousRooms.activeRooms.map(updateRoomItem);
        }

        queryClient.setQueryData<RoomsQueryResult>(roomsQueryKey, {
          allRooms: updatedAllRooms,
          activeRooms: updatedActiveRooms,
        });
      }
      return { previousRooms };
    },
    onError: (err: unknown, _vars, context) => {
      if (context?.previousRooms) {
        queryClient.setQueryData(roomsQueryKey, context.previousRooms);
      }
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "Xatolik yuz berdi";
      toast.error(message);
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
    mutationFn: async ({ id, status }: { id: string; status: RoomStatus | string }) => {
      const hotel = await getPrimaryHotel(accessToken);
      return toRoom(
        await partners.updateRoom(hotel.id, id, { status }, accessToken),
      );
    },
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey: roomsQueryKey });
      const previousRooms = queryClient.getQueryData<RoomsQueryResult>(roomsQueryKey);
      if (previousRooms) {
        const isRawStatus = status === 'active' || status === 'inactive';
        const updateRoomItem = (r: Room): Room => {
          if (r.id !== id) return r;
          return {
            ...r,
            status: isRawStatus ? r.status : (status as RoomStatus),
            ...(isRawStatus ? { _rawStatus: status, isListed: status === 'active' } : {}),
          };
        };

        const updatedAllRooms = previousRooms.allRooms.map(updateRoomItem);
        const updatedTarget = updatedAllRooms.find((r) => r.id === id);

        let updatedActiveRooms: Room[];
        if (status === 'inactive') {
          updatedActiveRooms = previousRooms.activeRooms.filter((r) => r.id !== id);
        } else if (status === 'active') {
          const exists = previousRooms.activeRooms.some((r) => r.id === id);
          if (exists) {
            updatedActiveRooms = previousRooms.activeRooms.map(updateRoomItem);
          } else if (updatedTarget) {
            updatedActiveRooms = [...previousRooms.activeRooms, updatedTarget];
          } else {
            updatedActiveRooms = previousRooms.activeRooms;
          }
        } else {
          updatedActiveRooms = previousRooms.activeRooms.map(updateRoomItem);
        }

        queryClient.setQueryData<RoomsQueryResult>(roomsQueryKey, {
          allRooms: updatedAllRooms,
          activeRooms: updatedActiveRooms,
        });
      }
      return { previousRooms };
    },
    onError: (err: unknown, _vars, context) => {
      if (context?.previousRooms) {
        queryClient.setQueryData(roomsQueryKey, context.previousRooms);
      }
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "Xatolik yuz berdi";
      toast.error(message);
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
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "O'chirishda xatolik yuz berdi";
      toast.error(message);
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
          prefix: values.prefix,
        },
        accessToken,
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: roomsQueryKey });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "Yaratishda xatolik yuz berdi";
      toast.error(message);
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
      void qc.invalidateQueries({ queryKey: roomsQueryKey });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "Rasm yuklashda xatolik yuz berdi";
      toast.error(message);
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
      void qc.invalidateQueries({ queryKey: roomsQueryKey });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "Rasmni o'chirishda xatolik yuz berdi";
      toast.error(message);
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
      void qc.invalidateQueries({ queryKey: roomsQueryKey });
    },
    onError: (err: unknown) => {
      const message =
        err instanceof Error
          ? err.message
          : (err as { message?: string })?.message || "Rasm ma'lumotlarini yangilashda xatolik yuz berdi";
      toast.error(message);
    },
  });
}
