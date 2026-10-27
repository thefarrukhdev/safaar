import { useQuery } from "@tanstack/react-query";
import { catalog } from "../_lib/api";

export function useAmenities() {
  return useQuery({
    queryKey: ["catalog", "amenities"],
    queryFn: () => catalog.listAmenities(),
  });
}

export function useCities() {
  return useQuery({
    queryKey: ["catalog", "cities"],
    queryFn: () => catalog.listCities(),
    staleTime: 1000 * 60 * 10, // 10 daqiqa keshlaymiz
  });
}

export function useCancellationPolicies() {
  return useQuery({
    queryKey: ["catalog", "cancellation-policies"],
    queryFn: () => catalog.listCancellationPolicies(),
    staleTime: 1000 * 60 * 10,
  });
}
