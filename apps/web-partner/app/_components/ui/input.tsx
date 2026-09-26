"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "../../_lib/utils/cn";
import { Eye, EyeOff } from "lucide-react";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, ...props },
  ref,
) {
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = type === "password";
  const inputType = isPassword ? (showPassword ? "text" : "password") : type;

  return (
    <div className="relative w-full">
    <input
      ref={ref}
      className={cn(
        "h-9 w-full rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 text-sm shadow-sm shadow-slate-950/5",
        "transition-all duration-150",
        "placeholder:text-zinc-400",
        "hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]/45",
        "focus:border-brand-600 focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-brand-200 dark:focus:ring-brand-900",
        "aria-[invalid=true]:border-red-500 aria-[invalid=true]:focus:ring-red-200 dark:aria-[invalid=true]:focus:ring-red-900",
        "disabled:cursor-not-allowed disabled:opacity-60",
        isPassword ? "pr-10" : "",
        className,
      )}
      type={inputType}
      {...props}
    />
    {isPassword && (
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 focus:outline-none"
      >
        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    )}
    </div>
  );
});
