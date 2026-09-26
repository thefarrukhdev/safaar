"use client";

import { cn } from "@/lib/utils";
import { useState, type InputHTMLAttributes } from "react";
import { Search, Eye, EyeOff } from "lucide-react";

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
  const [showPassword, setShowPassword] = useState(false);
  const inputId = id ?? label?.toLowerCase().replace(/ /g, "-");
  
  const isPassword = rest.type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : rest.type;

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
            isPassword ? "pr-10" : undefined,
            error && "border-[var(--danger)] focus:ring-[var(--danger)]/20",
            className
          )}
          {...rest}
          type={inputType}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] dark:hover:text-white focus:outline-none"
          >
            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {error && <span className="text-xs text-[var(--danger)]">{error}</span>}
    </div>
  );
}
