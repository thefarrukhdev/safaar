"use client";

import {
  CheckCircle2,
  Circle,
  Clock,
  LogIn,
  LogOut,
  Plus,
  XCircle,
} from "lucide-react";
import { BookingStatus } from "@safaar/types";
import type { ReservationView } from "../../_lib/domain/types";
import { cn } from "../../_lib/utils/cn";
import { formatDateTime } from "../../_lib/utils/format";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels } from "../../_lib/utils/partner-labels";

interface TimelineStep {
  key: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  date?: string;
  detail?: string;
  state: "done" | "current" | "pending" | "skipped";
}

function buildSteps(r: ReservationView, unitLabel: string, checkInLabel: string, checkOutLabel: string): TimelineStep[] {
  const cancelled = r.status === BookingStatus.CANCELLED;
  const completed = r.status === BookingStatus.COMPLETED;
  const inHouse = r.status === "IN_HOUSE";
  const confirmed = r.status === BookingStatus.CONFIRMED;

  return [
    {
      key: "created",
      icon: Plus,
      label: "Bron yaratildi",
      date: r.createdAt,
      state: "done",
    },
    {
      key: "confirmed",
      icon: CheckCircle2,
      label: "Tasdiqlangan",
      state: cancelled
        ? "skipped"
        : confirmed || inHouse || completed
          ? "done"
          : "current",
    },
    {
      key: "checkin",
      icon: LogIn,
      label: checkInLabel,
      detail: r.roomNumber ? `${unitLabel} ${r.roomNumber}` : undefined,
      state: cancelled
        ? "skipped"
        : inHouse || completed
          ? "done"
          : confirmed
            ? "current"
            : "pending",
    },
    {
      key: "checkout",
      icon: LogOut,
      label: checkOutLabel,
      date: completed ? r.checkOut : undefined,
      state: cancelled
        ? "skipped"
        : completed
          ? "done"
          : inHouse
            ? "current"
            : "pending",
    },
    ...(cancelled
      ? [
          {
            key: "cancelled",
            icon: XCircle,
            label: "Bekor qilingan",
            state: "done" as const,
          },
        ]
      : []),
  ];
}

export function ReservationTimeline({
  reservation,
}: {
  reservation: ReservationView;
}) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const unitCap = labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1);
  const steps = buildSteps(
    reservation,
    unitCap,
    labels.checkInActionLabel ?? labels.checkInLabel,
    labels.checkOutActionLabel ?? labels.checkOutLabel,
  );

  return (
    <ol className="flex flex-col">
      {steps.map((step, i) => (
        <li key={step.key} className="relative flex gap-3">
          {/* Vertikal chiziq */}
          {i < steps.length - 1 && (
            <span
              className={cn(
                "absolute left-4 top-8 h-full w-px",
                step.state === "done"
                  ? "bg-accent-500"
                  : "bg-[var(--border)]",
              )}
              aria-hidden
            />
          )}

          {/* Ikon */}
          <span
            className={cn(
              "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-2",
              step.state === "done" &&
                "bg-accent-100 text-accent-700 ring-accent-200 dark:bg-accent-900/40 dark:text-accent-300 dark:ring-accent-800",
              step.state === "current" &&
                "bg-brand-100 text-brand-700 ring-brand-200 dark:bg-brand-900/40 dark:text-brand-300 dark:ring-brand-800 animate-pulse",
              step.state === "pending" &&
                "bg-zinc-100 text-zinc-400 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:ring-zinc-700",
              step.state === "skipped" &&
                "bg-zinc-100 text-zinc-300 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-600 dark:ring-zinc-700",
            )}
          >
            {step.state === "pending" ? (
              <Circle className="h-3.5 w-3.5" aria-hidden />
            ) : step.state === "current" ? (
              <Clock className="h-4 w-4" aria-hidden />
            ) : (
              <step.icon className="h-4 w-4" aria-hidden />
            )}
          </span>

          {/* Matn */}
          <div
            className={cn(
              "flex flex-1 flex-col pb-4",
              step.state === "skipped" && "opacity-40",
            )}
          >
            <span
              className={cn(
                "text-sm font-semibold",
                step.state === "pending" && "text-[var(--muted-foreground)]",
                step.state === "skipped" && "line-through",
              )}
            >
              {step.label}
            </span>
            <div className="flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-[var(--muted-foreground)]">
              {step.date && <span>{formatDateTime(step.date)}</span>}
              {!step.date && step.state === "pending" && <span>kutilmoqda</span>}
              {step.detail && (
                <>
                  <span>·</span>
                  <span className="font-mono text-brand-700 dark:text-brand-300">
                    {step.detail}
                  </span>
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
