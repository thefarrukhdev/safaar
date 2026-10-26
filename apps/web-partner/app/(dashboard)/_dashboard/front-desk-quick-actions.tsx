"use client";

import {
  BedDouble,
  CalendarDays,
  ChevronRight,
  FileText,
  Home,
  Sparkles,
  Users,
  UtensilsCrossed,
  Zap,
} from "lucide-react";
import Link from "next/link";
import { Badge, type BadgeTone } from "../../_components/ui/badge";
import { Card, CardBody } from "../../_components/ui/card";
import { Skeleton } from "../../_components/ui/skeleton";
import { useBeds } from "../../_hooks/use-beds";
import { cn } from "../../_lib/utils/cn";
import type { PartnerLabels } from "../../_lib/utils/partner-labels";
import type { ReservationView } from "../../_lib/domain/types";
import type { Task, FrontDeskStatsData } from "./types";

interface FrontDeskQuickActionsProps {
  nextTask: Task | undefined;
  stats: FrontDeskStatsData;
  isLoading: boolean;
  labels: PartnerLabels;
  dacha: boolean;
  restaurant?: boolean;
  onViewDetails?: (reservation: ReservationView) => void;
}

export function FrontDeskQuickActions({
  nextTask,
  stats,
  isLoading,
  labels,
  dacha,
  restaurant,
  onViewDetails,
}: FrontDeskQuickActionsProps) {
  const vacantRooms = Math.max(0, stats.totalRooms - stats.occupiedRooms);

  return (
    <aside
      aria-label="Tezkor amallar va yo'nalishlar"
      className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-6 xl:self-start"
    >
      {/* 1. Shoshilinch vazifa kartasi */}
      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <CardBody className="p-4 sm:p-5 flex flex-col gap-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
              <h2 className="text-sm font-semibold text-[var(--foreground)]">
                Shoshilinch vazifa
              </h2>
            </div>
            {nextTask && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-600 dark:text-brand-400">
                Navbatdagi
              </span>
            )}
          </div>

          {isLoading ? (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3.5 animate-pulse">
              <div className="flex items-center gap-2.5 mb-2">
                <Skeleton className="h-7 w-7 rounded-lg" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-3 w-40" />
            </div>
          ) : nextTask ? (
            <NextTaskPreview
              task={nextTask}
              labels={labels}
              dacha={dacha}
              restaurant={restaurant}
              onViewDetails={onViewDetails}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface-muted)]/50 p-4 text-center text-xs text-[var(--muted-foreground)]">
              Hozircha shoshilinch vazifa yo&apos;q. Barcha amallar bajarilgan.
            </div>
          )}
        </CardBody>
      </Card>

      {/* 2. Xonalar holati qisqacha (Room availability snapshot) */}
      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <CardBody className="p-4 sm:p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">
              {labels.unitsPageTitle} holati
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <div className="flex flex-col p-2.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)]">
              <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                Band {labels.unitPlural}
              </span>
              <span className="text-lg font-bold text-brand-600 dark:text-brand-400 tabular-nums">
                {stats.occupiedRooms}
              </span>
            </div>
            <div className="flex flex-col p-2.5 rounded-xl bg-[var(--surface-muted)] border border-[var(--border)]">
              <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
                Bo&apos;sh {labels.unitPlural}
              </span>
              <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                {vacantRooms}
              </span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* 3. Tezkor yo'nalishlar (Quick Shortcuts) */}
      <Card className="border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <CardBody className="p-4 sm:p-5 flex flex-col gap-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)] mb-1 px-1">
            Tezkor yo&apos;nalishlar
          </h2>
          <QuickNavLink
            href="/reservations"
            icon={<Users className="h-4 w-4" />}
            label={labels.reservationsTitle}
          />
          <QuickNavLink
            href="/calendar"
            icon={<CalendarDays className="h-4 w-4" />}
            label="Kalendar"
          />
          <QuickNavLink
            href={dacha ? "/listing" : "/rooms"}
            icon={
              dacha ? (
                <Home className="h-4 w-4" />
              ) : restaurant ? (
                <UtensilsCrossed className="h-4 w-4" />
              ) : (
                <BedDouble className="h-4 w-4" />
              )
            }
            label={dacha ? labels.listingTitle : labels.unitsPageTitle}
          />
          <QuickNavLink
            href="/reports"
            icon={<FileText className="h-4 w-4" />}
            label="Moliya va hisobotlar"
          />
        </CardBody>
      </Card>
    </aside>
  );
}

function NextTaskPreview({
  task,
  labels,
  dacha,
  restaurant,
  onViewDetails,
}: {
  task: Task;
  labels: PartnerLabels;
  dacha: boolean;
  restaurant?: boolean;
  onViewDetails?: (reservation: ReservationView) => void;
}) {
  const { data: beds = [] } = useBeds();
  const bed = task.reservation.bedId ? beds.find((b) => b.id === task.reservation.bedId) : undefined;
  const kindLabel =
    task.kind === "pending"
      ? "Yangi bron"
      : task.kind === "arrival"
        ? labels.checkInLabel
        : labels.checkOutLabel;

  const badgeTone: BadgeTone =
    task.kind === "pending"
      ? "amber"
      : task.kind === "arrival"
        ? "emerald"
        : "blue";

  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm text-[var(--foreground)] group-hover:text-brand-600 dark:group-hover:text-brand-400 truncate">
          {task.reservation.guest.fullName}
        </span>
        <Badge variant="subtle" tone={badgeTone} className="shrink-0">
          {kindLabel}
        </Badge>
      </div>

      {!dacha && task.reservation.roomTypeName && (
        <div className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] truncate">
          <span className="truncate">
            {task.reservation.roomTypeName}
            {task.reservation.roomNumber && ` · ${task.reservation.roomNumber}`}
            {bed && ` · ${bed.label}`}
            {restaurant && task.reservation.slotTime && ` · ${task.reservation.slotTime}`}
          </span>
        </div>
      )}

      <div className="flex items-center justify-end text-[11px] font-medium text-brand-600 dark:text-brand-400 group-hover:translate-x-0.5 transition-transform">
        <span>Batafsil ko&apos;rish</span>
        <ChevronRight className="h-3 w-3 ml-0.5" />
      </div>
    </>
  );

  const containerClassName =
    "group flex flex-col gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-3 transition-all duration-150 hover:border-brand-300 hover:bg-brand-50/40 dark:hover:border-brand-800 dark:hover:bg-brand-950/20 text-left w-full";

  if (onViewDetails) {
    return (
      <button
        type="button"
        onClick={() => onViewDetails(task.reservation)}
        className={containerClassName}
      >
        {content}
      </button>
    );
  }

  return (
    <Link
      href={`/reservations/${task.reservation.id}`}
      className={containerClassName}
    >
      {content}
    </Link>
  );
}

function QuickNavLink({
  href,
  icon,
  label,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-[var(--foreground)]",
        "transition-colors hover:bg-[var(--surface-muted)] hover:text-brand-600 dark:hover:text-brand-400",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className="text-[var(--muted-foreground)]">{icon}</span>
        <span>{label}</span>
      </div>
      <ChevronRight className="h-4 w-4 text-[var(--muted-foreground)] opacity-60" />
    </Link>
  );
}
