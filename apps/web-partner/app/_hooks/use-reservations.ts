"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import { pageItems, toReservation } from "../_lib/api/adapters";
import { partners } from "../_lib/api";
import { type WalkInDraft } from "../_stores/data-store";
import { useAuthStore } from "../_stores/auth-store";
import { getPrimaryHotel } from "./use-primary-hotel";
import { roomsQueryKey } from "./use-rooms";
import { bedsQueryKey } from "./use-beds";
import type { ReservationView } from "../_lib/domain/types";

export interface VehicleWalkInDraft {
  vehicleId: string;
  checkIn: string;
  checkOut: string;
  fullName?: string;
  phone?: string;
  adults?: number;
  children?: number;
}

function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string"
  ) {
    return (err as { message: string }).message;
  }
  return "Xatolik yuz berdi";
}

export const reservationsQueryKey = ["partner", "bookings"] as const;

const EMPTY_RESERVATIONS: ReservationView[] = [];

export function useReservations() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const query = useQuery({
    queryKey: reservationsQueryKey,
    queryFn: async () => pageItems(await partners.listBookings(accessToken)).map(toReservation),
    enabled: Boolean(accessToken),
  });

  return {
    data: query.data ?? EMPTY_RESERVATIONS,
    isLoading: query.isLoading && !query.data,
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
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["partner", "dashboard"] });
      void queryClient.invalidateQueries({ queryKey: roomsQueryKey });
      void queryClient.invalidateQueries({ queryKey: bedsQueryKey });
    },
  });
}

export function useCreateWalkInVehicleReservation() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (draft: VehicleWalkInDraft) => {
      const names = (draft.fullName || 'Mehmon').trim().split(' ');
      const firstName = names[0];
      const lastName = names.slice(1).join(' ') || 'Mehmon';

      // `CreateVehicleRentalDto` (backend) has no `adults`/`children`/
      // `guestInfo` fields — vehicle rentals don't track passenger count,
      // and guest identity is flat (firstName/lastName/phone), not
      // nested. The global ValidationPipe runs with
      // `forbidNonWhitelisted: true`, so sending any of those three
      // makes the WHOLE request 400 (confirmed via a direct
      // plainToInstance+validate() run against the real DTO class).
      return toReservation(
        await partners.createVehicleBooking(
          {
            vehicle_id: draft.vehicleId,
            check_in: draft.checkIn,
            check_out: draft.checkOut,
            firstName,
            lastName,
            phone: draft.phone,
          },
          accessToken,
        ),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["partner", "dashboard"] });
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
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await partners.confirmBooking(id, accessToken);
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: reservationsQueryKey });
      const previousReservations = queryClient.getQueryData<ReservationView[]>(reservationsQueryKey);
      if (previousReservations) {
        queryClient.setQueryData<ReservationView[]>(
          reservationsQueryKey,
          previousReservations.map((r) =>
            r.id === id ? { ...r, status: BookingStatus.CONFIRMED } : r,
          ),
        );
      }
      return { previousReservations };
    },
    onError: (err: unknown, _id, context) => {
      if (context?.previousReservations) {
        queryClient.setQueryData(reservationsQueryKey, context.previousReservations);
      }
      toast.error(getErrorMessage(err));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["partner", "dashboard"] });
    },
  });
}

export function useRejectReservation() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      await partners.rejectBooking(id, reason, accessToken);
      return id;
    },
    onMutate: async ({ id }) => {
      await queryClient.cancelQueries({ queryKey: reservationsQueryKey });
      const previousReservations = queryClient.getQueryData<ReservationView[]>(reservationsQueryKey);
      if (previousReservations) {
        queryClient.setQueryData<ReservationView[]>(
          reservationsQueryKey,
          previousReservations.map((r) =>
            r.id === id ? { ...r, status: BookingStatus.CANCELLED } : r,
          ),
        );
      }
      return { previousReservations };
    },
    onError: (err: unknown, _vars, context) => {
      if (context?.previousReservations) {
        queryClient.setQueryData(reservationsQueryKey, context.previousReservations);
      }
      toast.error(getErrorMessage(err));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["partner", "dashboard"] });
    },
  });
}

export function useCheckIn() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const partnerType = useAuthStore.getState().user?.partnerType;
      if (partnerType === 'bus' || partnerType === 'rent_car') {
        await partners.board(id, accessToken);
      } else {
        await partners.checkIn(id, accessToken);
      }
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: reservationsQueryKey });
      const previousReservations = queryClient.getQueryData<ReservationView[]>(reservationsQueryKey);
      if (previousReservations) {
        queryClient.setQueryData<ReservationView[]>(
          reservationsQueryKey,
          previousReservations.map((r) =>
            r.id === id ? { ...r, status: "IN_HOUSE" as const } : r,
          ),
        );
      }
      return { previousReservations };
    },
    onError: (err: unknown, _id, context) => {
      if (context?.previousReservations) {
        queryClient.setQueryData(reservationsQueryKey, context.previousReservations);
      }
      toast.error(getErrorMessage(err));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["partner", "dashboard"] });
      void queryClient.invalidateQueries({ queryKey: roomsQueryKey });
      void queryClient.invalidateQueries({ queryKey: bedsQueryKey });
    },
  });
}

export function useAssignRoom() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
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
      return { id, roomNumber, bedId };
    },
    onMutate: async ({ id, roomNumber, bedId }) => {
      await queryClient.cancelQueries({ queryKey: reservationsQueryKey });
      const previousReservations = queryClient.getQueryData<ReservationView[]>(reservationsQueryKey);
      if (previousReservations) {
        queryClient.setQueryData<ReservationView[]>(
          reservationsQueryKey,
          previousReservations.map((r) =>
            r.id === id ? { ...r, roomNumber, bedId: bedId ?? r.bedId } : r,
          ),
        );
      }
      return { previousReservations };
    },
    onError: (err: unknown, _vars, context) => {
      if (context?.previousReservations) {
        queryClient.setQueryData(reservationsQueryKey, context.previousReservations);
      }
      toast.error(getErrorMessage(err));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["partner", "dashboard"] });
      void queryClient.invalidateQueries({ queryKey: roomsQueryKey });
      void queryClient.invalidateQueries({ queryKey: bedsQueryKey });
    },
  });
}

export function useCheckOut() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await partners.checkOut(id, accessToken);
      return id;
    },
    onMutate: async (id: string) => {
      await queryClient.cancelQueries({ queryKey: reservationsQueryKey });
      const previousReservations = queryClient.getQueryData<ReservationView[]>(reservationsQueryKey);
      if (previousReservations) {
        queryClient.setQueryData<ReservationView[]>(
          reservationsQueryKey,
          previousReservations.map((r) =>
            r.id === id ? { ...r, status: BookingStatus.COMPLETED } : r,
          ),
        );
      }
      return { previousReservations };
    },
    onError: (err: unknown, _id, context) => {
      if (context?.previousReservations) {
        queryClient.setQueryData(reservationsQueryKey, context.previousReservations);
      }
      toast.error(getErrorMessage(err));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: reservationsQueryKey });
      void queryClient.invalidateQueries({ queryKey: ["partner", "dashboard"] });
      void queryClient.invalidateQueries({ queryKey: roomsQueryKey });
      void queryClient.invalidateQueries({ queryKey: bedsQueryKey });
    },
  });
}
