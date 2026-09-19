"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { pageItems, toReservation } from "../_lib/api/adapters";
import { partners } from "../_lib/api";
import { useDataStore, type WalkInDraft } from "../_stores/data-store";
import { useAuthStore } from "../_stores/auth-store";
import { getPrimaryHotel } from "./use-primary-hotel";

export const reservationsQueryKey = ["partner", "bookings"] as const;

export function useReservations() {
  const data = useDataStore((s) => s.reservations);
  const setReservations = useDataStore((s) => s.setReservations);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const query = useQuery({
    queryKey: reservationsQueryKey,
    queryFn: async () => pageItems(await partners.listBookings(accessToken)).map(toReservation),
    enabled: Boolean(accessToken),
  });

  useEffect(() => {
    if (query.data) setReservations(query.data);
  }, [query.data, setReservations]);

  return {
    data,
    isLoading: query.isLoading && data.length === 0,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    isFetching: query.isFetching,
  };
}

export function useCreateWalkInReservation() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: WalkInDraft) => {
      const hotel = await getPrimaryHotel(accessToken);
      return toReservation(
        await partners.createBooking(
          {
            hotelId: hotel.id,
            roomTypeId: draft.roomTypeId,
            roomNumber: draft.roomNumber,
            bedId: draft.bedId,
            slotTime: draft.slotTime,
            fullName: draft.fullName,
            phone: draft.phone,
            checkIn: draft.checkIn,
            checkOut: draft.checkOut,
            adults: draft.adults,
            children: draft.children,
            nights: draft.nights,
            totalPrice: draft.totalPrice,
            source: "walk_in",
          },
          accessToken,
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
    },
  });
}

export function useCreateWalkInVehicleReservation() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: any) => {
      const names = (draft.fullName || 'Mehmon').trim().split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || 'Mehmon';

      return toReservation(
        await partners.createVehicleBooking(
          {
            vehicle_id: draft.vehicleId,
            check_in: draft.checkIn,
            check_out: draft.checkOut,
            adults: draft.adults ?? 1,
            children: draft.children ?? 0,
            guestInfo: {
              firstName,
              lastName,
              phone: draft.phone,
              email: null,
            },
          },
          accessToken,
        ),
      );
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
    },
  });
}

/** Bitta bron tafsiloti. */
export function useReservation(id: string) {
  const reservations = useReservations();
  const data = reservations.data.find((r) => r.id === id) ?? null;
  return { data, isLoading: reservations.isLoading };
}

export function useConfirmReservation() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const confirmLocal = useDataStore((s) => s.confirmReservation);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await partners.confirmBooking(id, accessToken);
      return id;
    },
    onSuccess: (id) => {
      confirmLocal(id);
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
    },
  });
}

export function useRejectReservation() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const rejectLocal = useDataStore((s) => s.rejectReservation);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await partners.rejectBooking(id, reason, accessToken);
      return id;
    },
    onSuccess: (id) => {
      rejectLocal(id);
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
    },
  });
}

export function useCheckIn() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const checkInLocal = useDataStore((s) => s.checkIn);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await partners.checkIn(id, accessToken);
      return id;
    },
    onSuccess: (id) => {
      checkInLocal(id);
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
    },
  });
}

export function useAssignRoom() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const assignRoomLocal = useDataStore((s) => s.assignRoom);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      roomNumber,
      bedId,
    }: {
      id: string;
      roomNumber: string;
      bedId?: string;
    }) => {
      await partners.assignRoom(id, roomNumber, accessToken, bedId);
      return { id, roomNumber };
    },
    onSuccess: ({ id, roomNumber }) => {
      assignRoomLocal(id, roomNumber);
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
    },
  });
}

export function useCheckOut() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const checkOutLocal = useDataStore((s) => s.checkOut);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await partners.checkOut(id, accessToken);
      return id;
    },
    onSuccess: (id) => {
      checkOutLocal(id);
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
    },
  });
}
