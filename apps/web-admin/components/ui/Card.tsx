import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  title?: string;
  description?: string;
}

const paddingStyles = {
  none: "p-0",
  sm: "p-4",
  md: "p-5",
  lg: "p-6",
};

export default function Card({ children, className, hover = false, padding = "md" }: CardProps) {
  return (
    <div
      className={cn(
        "bg-white rounded-xl border border-[var(--border)]",
        "shadow-[var(--shadow-card)]",
        paddingStyles[padding],
        hover && "card-hover cursor-pointer",
        className
      )}
    >
      {children}
    </div>
  );
}

/* ────────────── Stat Card (Dashboard) ────────────── */

interface StatCardProps {
  label: string;
  value: string;
  change?: number;
  icon: ReactNode;
  color: string;
}

export function StatCard({ label, value, change, icon, color }: StatCardProps) {
  const isPositive = change !== undefined && change >= 0;

  return (
    <div className="bg-white rounded-xl border border-[var(--border)] shadow-[var(--shadow-card)] p-5 card-hover">
      <div className="flex items-start justify-between">
        <div className="flex flex-col gap-1">
          <span className="text-sm text-[var(--text-muted)] font-medium">{label}</span>
          <span className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{value}</span>
        </div>
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: color + "14", color }}
        >
          {icon}
        </div>
      </div>
      {change !== undefined && (
        <div className="mt-3 flex items-center gap-1.5">
          <span
            className="text-xs font-semibold px-1.5 py-0.5 rounded"
            style={{
              color: isPositive ? "var(--success)" : "var(--danger)",
              backgroundColor: isPositive ? "rgba(46,204,113,0.1)" : "rgba(231,76,60,0.1)",
            }}
          >
            {isPositive ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
          </span>
          <span className="text-xs text-[var(--text-muted)]">o&apos;tgan oyga nisbatan</span>
        </div>
      )}
    </div>
  );
}
