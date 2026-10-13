import type { ReactNode } from "react";
import { cn } from "../../_lib/utils/cn";
import { Card, CardBody } from "./card";

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: { value: number; positive?: boolean };
  icon?: ReactNode;
  className?: string;
}

/** Dashboard'dagi KPI kartochkasi. */
export function StatCard({
  label,
  value,
  hint,
  trend,
  icon,
  className,
}: StatCardProps) {
  return (
    <Card interactive className={cn("group", className)}>
      <CardBody className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted-foreground)]">
            {label}
          </p>
          <p className="text-2xl font-bold tracking-tight tabular-nums">{value}</p>
          {hint ? (
            <p className="text-xs leading-5 text-[var(--muted-foreground)]">
              {hint}
            </p>
          ) : null}
          {trend ? (
            <p
              className={cn(
                "text-xs font-medium",
                trend.positive ? "text-accent-600" : "text-red-600",
              )}
            >
              {trend.positive ? "▲" : "▼"} {Math.abs(trend.value)}%
            </p>
          ) : null}
        </div>
        {icon ? (
          <div className="rounded-lg bg-gradient-to-b from-brand-50 to-accent-50 p-2 text-brand-700 ring-1 ring-brand-100 transition-transform duration-200 group-hover:scale-105 dark:from-brand-950/40 dark:to-accent-950/25 dark:text-brand-200 dark:ring-brand-900/60">
            {icon}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}
