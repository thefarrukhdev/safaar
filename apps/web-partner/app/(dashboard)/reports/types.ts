export type TimeRangePreset = "7days" | "30days" | "year" | "custom";
export type ViewTab = "stats" | "finance" | "detailed";

export interface ReportKPIs {
  revenue: number;
  bookings: number;
  occupancy: number;
  adr: number;
}
