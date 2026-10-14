import type { ReactNode } from "react";
import { cn } from "../../_lib/utils/cn";
import { Card, CardBody } from "./card";
import { Skeleton } from "./skeleton";

export type StatTone = "brand" | "emerald" | "blue" | "amber" | "neutral";

const toneIconStyles: Record<StatTone, string> = {
  brand:
    "bg-brand-50 text-brand-600 ring-brand-100 dark:bg-brand-950/40 dark:text-brand-300 dark:ring-brand-900/60",
  emerald:
    "bg-emerald-50 text-emerald-600 ring-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/60",
  blue:
    "bg-blue-50 text-blue-600 ring-blue-100 dark:bg-blue-950/40 dark:text-blue-300 dark:ring-blue-900/60",
  amber:
    "bg-amber-50 text-amber-600 ring-amber-100 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/60",
  neutral:
    "bg-[var(--surface-muted)] text-[var(--muted-foreground)] ring-[var(--border)]",
};

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: { value: number; positive?: boolean };
  icon?: ReactNode;
  tone?: StatTone;
  isLoading?: boolean;
  interactive?: boolean;
  children?: ReactNode;
  className?: string;
}

/** Dashboard'dagi KPI kartochkasi. */
export function StatCard({
  label,
  value,
  hint,
  trend,
  icon,
  tone,
  isLoading,
  interactive = true,
  children,
  className,
}: StatCardProps) {
  const iconBoxClass = tone
    ? toneIconStyles[tone]
    : "bg-gradient-to-b from-brand-50 to-accent-50 p-2 text-brand-700 ring-1 ring-brand-100 dark:from-brand-950/40 dark:to-accent-950/25 dark:text-brand-200 dark:ring-brand-900/60";

  return (
    <Card interactive={interactive} className={cn("group border-[var(--border)] bg-[var(--surface)] shadow-sm", className)}>
      <CardBody className="p-5 flex flex-col justify-between h-full gap-3">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                {label}
              </p>
              {isLoading ? (
                <Skeleton className="my-0.5 h-8 w-24" />
              ) : (
                <p className="text-2xl sm:text-3xl font-bold tracking-tight tabular-nums text-[var(--foreground)]">
                  {value}
                </p>
              )}
              {trend ? (
                <p
                  className={cn(
                    "text-xs font-medium",
                    trend.positive ? "text-accent-600 dark:text-accent-400" : "text-red-600 dark:text-red-400",
                  )}
                >
                  {trend.positive ? "▲" : "▼"} {Math.abs(trend.value)}%
                </p>
              ) : null}
            </div>
            {icon ? (
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105",
                  iconBoxClass,
                )}
              >
                {icon}
              </div>
            ) : null}
          </div>
          {children}
        </div>
        {hint ? (
          <div className="text-xs font-medium text-[var(--muted-foreground)]">
            {hint}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
