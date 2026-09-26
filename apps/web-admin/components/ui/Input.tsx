"use client";

import { cn } from "@/lib/utils";
import type { InputHTMLAttributes } from "react";
import { Search } from "lucide-react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
  isSearch?: boolean;
}

export default function Input({
  label,
  error,
  icon,
  isSearch,
  className,
  id,
  ...rest
}: InputProps) {
  const inputId = id ?? label?.toLowerCase().replace(/ /g, "-");

  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[var(--text-secondary)] dark:text-slate-300">
          {label}
        </label>
      )}
      <div className="relative">
        {(icon || isSearch) && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none">
            {icon ?? <Search size={16} />}
          </span>
        )}
        <input
          id={inputId}
          className={cn(
            "w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)]",
            "bg-white dark:bg-slate-900 text-[var(--text-primary)] dark:text-white",
            "placeholder:text-[var(--text-muted)]",
            "focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]",
            "transition-all duration-150",
            (icon ?? isSearch) ? "pl-9" : undefined,
            error && "border-[var(--danger)] focus:ring-[var(--danger)]/20",
            className
          )}
          {...rest}
        />
      </div>
      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  );
}
