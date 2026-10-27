"use client";

import { FileSpreadsheet } from "lucide-react";
import { useMemo } from "react";
import { Button } from "../../_components/ui/button";
import { Card, CardBody } from "../../_components/ui/card";
import { DateRangePicker, type DateRange } from "../../_components/ui/date-range-picker";
import { ReservationSource, type ReservationView } from "../../_lib/domain/types";
import { formatMoney } from "../../_lib/utils/format";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels, isRestaurant } from "../../_lib/utils/partner-labels";
import { exportReportToCsv } from "./export-report-csv";

interface ReportsDetailedTabProps {
  reservations: ReservationView[];
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
}

export function ReportsDetailedTab({
  reservations,
  dateRange,
  onDateRangeChange,
}: ReportsDetailedTabProps) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const isRest = isRestaurant(partnerType);

  const filtered = useMemo(() => {
    let list = reservations || [];
    if (dateRange.startDate) {
      list = list.filter((r) => r.checkIn.slice(0, 10) >= dateRange.startDate);
    }
    if (dateRange.endDate) {
      list = list.filter((r) => r.checkIn.slice(0, 10) <= dateRange.endDate);
    }
    return list;
  }, [reservations, dateRange.startDate, dateRange.endDate]);

  const onlineReservations = filtered.filter((r) => r.source === ReservationSource.UZBRON);
  const onsiteReservations = filtered.filter((r) => r.source !== ReservationSource.UZBRON);
  const totalRevenue = filtered.reduce((sum, r) => sum + r.totalPrice, 0);

  const handleExportCsv = () => {
    exportReportToCsv(filtered, "batafsil-hisobot", partnerType);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardBody className="p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-[var(--border)] pb-4">
            <div>
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Bronlar va To'lovlar (To'liq)
              </h2>
              <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                Onlayn va joyida qilingan to'lovlar bo'yicha batafsil hisobot
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <DateRangePicker
                startDate={dateRange.startDate}
                endDate={dateRange.endDate}
                onChange={onDateRangeChange}
                placeholder="Sana bo'yicha filter"
                showPresets
              />
              <Button
                onClick={handleExportCsv}
                variant="outline"
                className="gap-2 text-xs"
                disabled={filtered.length === 0}
              >
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                <span>CSV yuklab olish</span>
              </Button>
            </div>
          </div>

          {/* Stats summary blocks */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="p-4 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)]">
              <p className="text-xs text-[var(--muted-foreground)] mb-1">Jami bronlar</p>
              <p className="text-2xl font-bold text-zinc-900 dark:text-white">
                {filtered.length} ta
              </p>
            </div>
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-900/40">
              <p className="text-xs text-emerald-700 dark:text-emerald-400 mb-1">
                Onlayn (Safaar)
              </p>
              <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">
                {onlineReservations.length} ta
              </p>
            </div>
            <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
              <p className="text-xs text-amber-700 dark:text-amber-400 mb-1">
                Joyida to'lanadigan
              </p>
              <p className="text-2xl font-bold text-amber-900 dark:text-amber-300">
                {onsiteReservations.length} ta
              </p>
            </div>
            <div className="p-4 rounded-xl bg-brand-50 dark:bg-brand-950/20 border border-brand-200/60 dark:border-brand-900/40">
              <p className="text-xs text-brand-700 dark:text-brand-400 mb-1">
                Jami aylanma
              </p>
              <p className="text-2xl font-bold text-brand-900 dark:text-brand-300">
                {formatMoney(totalRevenue)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
                <tr>
                  <th className="px-4 py-3 font-semibold text-[var(--muted-foreground)] uppercase">
                    Mijoz
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--muted-foreground)] uppercase">
                    Sana
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--muted-foreground)] uppercase">
                    {labels.unitSingular} / Toifa
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--muted-foreground)] uppercase">
                    Summa
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--muted-foreground)] uppercase">
                    To'lov turi
                  </th>
                  <th className="px-4 py-3 font-semibold text-[var(--muted-foreground)] uppercase">
                    Holat
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-12 text-center text-xs text-[var(--muted-foreground)]"
                    >
                      Ushbu sana oralig'ida bronlar topilmadi
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => {
                    const isOnline = r.source === ReservationSource.UZBRON;
                    return (
                      <tr
                        key={r.id}
                        className="hover:bg-[var(--surface-muted)] transition-colors"
                      >
                        <td className="px-4 py-3">
                          <div className="font-semibold text-zinc-900 dark:text-white">
                            {r.guest?.fullName ?? "—"}
                          </div>
                          <div className="text-[11px] text-[var(--muted-foreground)] font-mono">
                            {r.guest?.phone}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            {isRest && r.slotTime
                              ? `${formatShortDate(r.checkIn)} · ${r.slotTime}`
                              : `${formatShortDate(r.checkIn)} — ${formatShortDate(r.checkOut)}`}
                          </div>
                          <div className="text-[11px] text-[var(--muted-foreground)]">
                            {isRest ? "1 tashrif" : `${r.nights} ${labels.isBus ? "kun" : "kecha"}`}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-900 dark:text-zinc-100">
                            {r.roomTypeName}
                          </div>
                          {r.roomNumber && (
                            <div className="text-[11px] text-[var(--muted-foreground)] font-mono">
                              {labels.unitSingular} {r.roomNumber}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                          {formatMoney(r.totalPrice)}
                        </td>
                        <td className="px-4 py-3">
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Online (Safaar)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                              Joyida (Naqd/Karta)
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] text-zinc-500 uppercase font-mono">
                            {r.status}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

function formatShortDate(isoDate: string) {
  const d = new Date(isoDate);
  const months = [
    "Yan",
    "Fev",
    "Mar",
    "Apr",
    "May",
    "Iyun",
    "Iyul",
    "Avg",
    "Sen",
    "Okt",
    "Noy",
    "Dek",
  ];
  return `${d.getDate()}-${months[d.getMonth()]}`;
}
