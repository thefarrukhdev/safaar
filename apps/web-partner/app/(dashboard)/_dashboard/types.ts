import type { ReservationView } from "../../_lib/domain/types";

export type TaskKind = "pending" | "arrival" | "departure";
export type FilterKey = "all" | TaskKind;

export interface Task {
  kind: TaskKind;
  reservation: ReservationView;
}

export interface FrontDeskStatsData {
  occupancyPercent: number;
  occupiedRooms: number;
  totalRooms: number;
  arrivalsToday: number;
  departuresToday: number;
  monthRevenue: number;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

