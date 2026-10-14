export type VehicleStatus = "active" | "inactive";

export interface Vehicle {
  id: string;
  name: string;
  plateNumber: string | null;
  seatsCount: number;
  pricePerDay: number;
  status: VehicleStatus;
}

export type VehicleStatusFilter = "all" | "active" | "inactive";

export type VehicleSortOption =
  | "name"
  | "price_asc"
  | "price_desc"
  | "seats_desc"
  | "status";

export interface VehicleMetrics {
  total: number;
  active: number;
  inactive: number;
  activeRate: number;
}
