import type { GuestProfile } from "../../_lib/domain/types";

export type SortOption =
  | "name-asc"
  | "name-desc"
  | "stays-desc"
  | "spent-desc"
  | "last-stay-desc";

export interface GuestCalculatedStats {
  totalStays: number;
  totalSpent: number;
  lastStay?: string;
  rejectedStays: number;
}

export interface GuestStatsData {
  totalGuests: number;
  vipGuests: number;
  avgStays: number;
  totalRevenue: number;
}

export interface GuestFiltersState {
  query: string;
  vipOnly: boolean;
  sortBy: SortOption;
}

export type GuestWithStats = GuestProfile & {
  calculatedStats: GuestCalculatedStats;
};
