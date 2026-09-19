import * as React from "react";
import { cn } from "@/lib/cn";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "brand" | "deal" | "success" | "danger";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-slate-900/[0.05] text-slate-900/70",
    secondary: "bg-slate-900/[0.05] text-slate-900/70",
    destructive: "bg-red-600/[0.10] text-red-700",
    outline: "border border-slate-900/[0.08] text-slate-900/70",
    brand: "bg-blue-600/[0.10] text-blue-700",
    deal: "bg-amber-500 text-slate-900 font-semibold",
    success: "bg-emerald-600/[0.10] text-emerald-800",
    danger: "bg-red-600/[0.10] text-red-700",
  };

  return (
    <div
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2",
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
