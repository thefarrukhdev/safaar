import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "../../_lib/utils/cn";

export type BadgeTone =
  | "neutral"
  | "brand"
  | "accent"
  | "warning"
  | "danger"
  | "amber"
  | "emerald"
  | "blue";

export type BadgeVariant = "text" | "subtle" | "outline";

const textToneClasses: Record<BadgeTone, string> = {
  neutral: "text-[var(--muted-foreground)]",
  brand: "text-brand-600 dark:text-brand-400",
  accent: "text-accent-600 dark:text-accent-400",
  warning: "text-amber-600 dark:text-amber-400",
  amber: "text-amber-600 dark:text-amber-400",
  danger: "text-red-600 dark:text-red-400",
  emerald: "text-emerald-600 dark:text-emerald-400",
  blue: "text-blue-600 dark:text-blue-400",
};

const subtleToneClasses: Record<BadgeTone, string> = {
  neutral:
    "bg-[var(--surface-muted)] text-[var(--muted-foreground)] border border-[var(--border)]",
  brand:
    "bg-brand-50 text-brand-700 border border-brand-200/80 dark:bg-brand-950/50 dark:text-brand-300 dark:border-brand-900/60",
  accent:
    "bg-accent-50 text-accent-700 border border-accent-200/80 dark:bg-accent-950/50 dark:text-accent-300 dark:border-accent-900/60",
  warning:
    "bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60",
  amber:
    "bg-amber-50 text-amber-700 border border-amber-200/80 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900/60",
  danger:
    "bg-red-50 text-red-700 border border-red-200/80 dark:bg-red-950/50 dark:text-red-300 dark:border-red-900/60",
  emerald:
    "bg-emerald-50 text-emerald-700 border border-emerald-200/80 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-900/60",
  blue:
    "bg-blue-50 text-blue-700 border border-blue-200/80 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900/60",
};

const outlineToneClasses: Record<BadgeTone, string> = {
  neutral: "border border-[var(--border)] text-[var(--muted-foreground)]",
  brand: "border border-brand-300 text-brand-700 dark:border-brand-800 dark:text-brand-300",
  accent: "border border-accent-300 text-accent-700 dark:border-accent-800 dark:text-accent-300",
  warning: "border border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300",
  amber: "border border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-300",
  danger: "border border-red-300 text-red-700 dark:border-red-800 dark:text-red-300",
  emerald: "border border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-300",
  blue: "border border-blue-300 text-blue-700 dark:border-blue-800 dark:text-blue-300",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
  variant?: BadgeVariant;
  icon?: ReactNode;
}

export function Badge({
  className,
  tone = "neutral",
  variant = "text",
  icon,
  children,
  ...props
}: BadgeProps) {
  const variantStyles =
    variant === "subtle"
      ? cn("rounded-full px-2.5 py-0.5", subtleToneClasses[tone])
      : variant === "outline"
        ? cn("rounded-full px-2.5 py-0.5", outlineToneClasses[tone])
        : textToneClasses[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider",
        variantStyles,
        className,
      )}
      {...props}
    >
      {icon && <span className="-ml-0.5 inline-flex shrink-0">{icon}</span>}
      {children}
    </span>
  );
}
