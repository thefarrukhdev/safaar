"use client";

import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "accent";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  icon?: ReactNode;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-[var(--primary)] text-white hover:bg-[var(--primary-light)] active:bg-[var(--primary-dark)] shadow-sm",
  secondary:
    "bg-white text-[var(--text-primary)] border border-[var(--border)] hover:bg-[var(--bg-tertiary)] hover:border-[var(--text-muted)]",
  danger:
    "bg-[var(--danger)] text-white hover:bg-[#c0392b] active:bg-[#a93226]",
  ghost:
    "bg-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] hover:text-[var(--text-primary)]",
  accent:
    "bg-[var(--accent)] text-white hover:bg-[var(--accent-dark)] active:bg-[#1e8e4e]",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-3 py-1.5 text-xs gap-1.5 rounded-md",
  md: "px-4 py-2 text-sm gap-2 rounded-lg",
  lg: "px-6 py-2.5 text-base gap-2.5 rounded-lg",
};

export default function Button({
  variant = "primary",
  size = "md",
  children,
  icon,
  loading,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center font-medium transition-all duration-150 cursor-pointer",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)]",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        variantStyles[variant],
        sizeStyles[size],
        className
      )}
      {...rest}
    >
      {loading ? (
        <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      ) : icon ? (
        <span className="shrink-0">{icon}</span>
      ) : null}
      {children}
    </button>
  );
}
