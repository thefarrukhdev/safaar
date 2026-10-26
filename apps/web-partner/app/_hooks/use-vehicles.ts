"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { partners } from "../_lib/api";
import { useAuthStore } from "../_stores/auth-store";
import type { Vehicle, VehicleStatus } from "../(dashboard)/rooms/vehicles-types";

export const vehiclesQueryKey = ["partner", "vehicles"] as const;

export type VehicleDraft = {
  name: string;
  plateNumber: string;
  seatsCount: number;
  pricePerDay: number;
  status: "active" | "inactive";
};

export type { Vehicle, VehicleStatus };

const EMPTY_VEHICLES: Vehicle[] = [];

export function useVehicles() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const isBus = partnerType === 'bus' || partnerType === 'rent_car';
  
  const query = useQuery({
    queryKey: vehiclesQueryKey,
    queryFn: async (): Promise<Vehicle[]> => {
      const data = await partners.listVehicles(accessToken);
      return data.map((v) => ({
        id: v.id,
        name: v.name,
        plateNumber: v.plate_number,
        seatsCount: v.seats_count,
        pricePerDay: v.price_per_day,
        status: (v.status === 'inactive' ? 'inactive' : 'active') as VehicleStatus,
      }));
    },
    enabled: Boolean(accessToken) && isBus,
  });

  return { 
    data: query.data ?? EMPTY_VEHICLES, 
    isLoading: query.isLoading && !query.data,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}

export function useCreateVehicle() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (values: VehicleDraft) => {
      return partners.createVehicle({
        name: values.name,
        plate_number: values.plateNumber,
        seats_count: values.seatsCount,
        price_per_day: values.pricePerDay,
        status: values.status,
      }, accessToken);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vehiclesQueryKey });
    },
  });
}

export function useUpdateVehicle() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<VehicleDraft> }) => {
      const payload: Record<string, unknown> = {};
      if (values.name !== undefined) payload.name = values.name;
      if (values.plateNumber !== undefined) payload.plate_number = values.plateNumber;
      if (values.seatsCount !== undefined) payload.seats_count = values.seatsCount;
      if (values.pricePerDay !== undefined) payload.price_per_day = values.pricePerDay;
      if (values.status !== undefined) payload.status = values.status;
      
      return partners.updateVehicle(id, payload, accessToken);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: vehiclesQueryKey });
    },
  });
}
