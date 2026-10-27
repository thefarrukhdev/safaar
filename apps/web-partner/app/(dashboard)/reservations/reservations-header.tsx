"use client";

import { CalendarPlus, Download, RefreshCw, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../_components/ui/button";
import { Tooltip } from "../../_components/ui/tooltip";
import { PageHeader } from "../../_components/layout/page-header";
import type { PartnerLabels } from "../../_lib/utils/partner-labels";
import type { Bed, ReservationView } from "../../_lib/domain/types";
import { exportReservationsToCsv } from "./export-csv";
import { cn } from "../../_lib/utils/cn";

interface ReservationsHeaderProps {
  labels: PartnerLabels;
  filteredCount: number;
  filteredReservations: ReservationView[];
  beds: Bed[];
  isRestaurant: boolean;
  isFetching: boolean;
  isRealtimeConnected: boolean;
  onRefresh: () => void;
  onOpenWalkIn: () => void;
}

export function ReservationsHeader({
  labels,
  filteredCount,
  filteredReservations,
  beds,
  isRestaurant,
  isFetching,
  isRealtimeConnected,
  onRefresh,
  onOpenWalkIn,
}: ReservationsHeaderProps) {
  const handleExport = () => {
    if (filteredReservations.length === 0) {
      toast.info("Eksport qilish uchun bronlar mavjud emas");
      return;
    }
    exportReservationsToCsv(
      filteredReservations,
      labels.unitSingular,
      beds,
      isRestaurant,
      labels.isBus,
    );
    toast.success(`${filteredReservations.length} ta bron CSV formatida yuklab olindi`);
  };

  return (
    <PageHeader
      eyebrow="Bron boshqaruvi"
      title={
        <span className="flex items-center gap-2.5">
          <span>{labels.reservationsTitle}</span>
          <span className="inline-flex items-center justify-center rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200/80 dark:bg-brand-950/50 dark:text-brand-300 dark:ring-brand-900/60 tabular-nums">
            {filteredCount}
          </span>
        </span>
      }
      description={`Web-userdan kelgan buyurtmalar, walk-in bronlar, to'lov va ${labels.checkInLabel.toLowerCase()} jarayonlari.`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {/* Live Socket Status */}
          <div
            className={cn(
              "hidden sm:inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border transition-colors",
              isRealtimeConnected
                ? "border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300"
                : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400",
            )}
            title={isRealtimeConnected ? "Real vaqt sinxronizatsiyasi faol" : "Ulanish kutilmoqda"}
          >
            {isRealtimeConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                <span>Jonli</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-zinc-400" aria-hidden />
                <span>Oflayn</span>
              </>
            )}
          </div>

          {/* Refresh Action */}
          <Tooltip content="Ma'lumotlarni yangilash" side="bottom">
            <Button
              variant="outline"
              size="icon"
              onClick={onRefresh}
              disabled={isFetching}
              aria-label="Ma'lumotlarni yangilash"
              className="h-10 w-10 min-h-[44px] min-w-[44px] sm:h-9 sm:w-9 sm:min-h-[36px] sm:min-w-[36px]"
            >
              <RefreshCw
                className={cn("h-4 w-4", isFetching && "animate-spin text-brand-600")}
                aria-hidden
              />
            </Button>
          </Tooltip>

          {/* CSV Export */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={filteredReservations.length === 0}
            className="min-h-[44px] sm:min-h-[36px] px-3 gap-1.5"
            title="Excel / CSV formatida eksport"
          >
            <Download className="h-4 w-4 text-[var(--muted-foreground)]" aria-hidden />
            <span>CSV</span>
          </Button>

          {/* New / Walk-in Booking */}
          <Button
            size="sm"
            onClick={onOpenWalkIn}
            className="min-h-[44px] sm:min-h-[36px] px-3.5 gap-1.5 shadow-sm font-semibold"
          >
            <CalendarPlus className="h-4 w-4" aria-hidden />
            <span>{labels.walkInTitle}</span>
          </Button>
        </div>
      }
    />
  );
}
