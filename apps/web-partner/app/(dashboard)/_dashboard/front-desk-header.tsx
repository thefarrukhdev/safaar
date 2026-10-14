"use client";

import { AlertCircle, CalendarDays, CalendarPlus } from "lucide-react";
import Link from "next/link";
import { Button } from "../../_components/ui/button";
import { PageHeader } from "../../_components/layout/page-header";
import { TODAY_ISO } from "../../_lib/utils/date";
import type { PartnerLabels } from "../../_lib/utils/partner-labels";

const WEEKDAYS = [
  "Yakshanba",
  "Dushanba",
  "Seshanba",
  "Chorshanba",
  "Payshanba",
  "Juma",
  "Shanba",
];

const MONTHS = [
  "yanvar",
  "fevral",
  "mart",
  "aprel",
  "may",
  "iyun",
  "iyul",
  "avgust",
  "sentyabr",
  "oktyabr",
  "noyabr",
  "dekabr",
];

interface FrontDeskHeaderProps {
  labels: PartnerLabels;
  requiresCompanyDetails?: boolean;
  onNewBooking: () => void;
}

export function FrontDeskHeader({
  labels,
  requiresCompanyDetails,
  onNewBooking,
}: FrontDeskHeaderProps) {
  const today = new Date(TODAY_ISO);
  const monthName = MONTHS[today.getMonth()];
  const dayNumber = today.getDate();
  const weekdayName = WEEKDAYS[today.getDay()];

  return (
    <header className="flex flex-col gap-4">
      <PageHeader
        eyebrow={labels.dashboardEyebrow}
        title={
          <div className="flex items-center gap-3 mt-1">
            <div
              className="flex flex-col overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm min-w-[4.25rem] shrink-0"
              aria-hidden="true"
            >
              <div className="bg-brand-600 px-1 py-1 text-center text-[10px] font-bold uppercase tracking-wider text-white">
                {monthName}
              </div>
              <div className="py-1 text-center text-xl font-black leading-none text-[var(--foreground)] tabular-nums">
                {dayNumber}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-xl sm:text-2xl font-bold leading-none text-[var(--foreground)] tracking-tight">
                {weekdayName}
              </span>
              <span className="text-xs sm:text-sm font-medium leading-none text-[var(--muted-foreground)]">
                {labels.frontDeskDescription}
              </span>
            </div>
          </div>
        }
        description=""
        actions={
          <div className="flex items-center gap-2.5">
            <Button variant="outline" asChild size="md">
              <Link href="/calendar">
                <CalendarDays className="h-4 w-4" aria-hidden="true" />
                <span>Kalendar</span>
              </Link>
            </Button>
            <Button onClick={onNewBooking} size="md">
              <CalendarPlus className="h-4 w-4" aria-hidden="true" />
              <span>{labels.newBookingLabel}</span>
            </Button>
          </div>
        }
      />

      {requiresCompanyDetails && (
        <section
          role="alert"
          aria-label="Tashkilot bank hisob raqami kiritilmagan"
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-amber-300/80 bg-amber-50/90 p-4 dark:border-amber-700/50 dark:bg-amber-950/30 shadow-sm"
        >
          <div className="flex items-start sm:items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300">
              <AlertCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-semibold text-amber-950 dark:text-amber-200">
                Tashkilot bank hisob raqami kiritilmagan
              </p>
              <p className="text-xs text-amber-900/80 dark:text-amber-300/80">
                Amallarni to&apos;liq bajarish va mablag&apos;larni yechib olish uchun kompaniya nomi va hisob raqami kiritilishi majburiy.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="border-amber-300 bg-white/80 text-amber-950 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-900/40 dark:text-amber-100 dark:hover:bg-amber-900/60 shrink-0 self-start sm:self-auto"
            asChild
          >
            <Link href="/settings/hotel">Rekvizitlarni kiritish</Link>
          </Button>
        </section>
      )}
    </header>
  );
}
