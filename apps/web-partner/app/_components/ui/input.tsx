"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { cn } from "../../_lib/utils/cn";
import { Eye, EyeOff } from "lucide-react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  hideToggle?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, type, hideToggle, ...props },
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
        "focus:border-blue-600 focus:bg-[var(--surface)] focus:outline-none focus:ring-2 focus:ring-blue-500/25",
        "focus-visible:border-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25",
        "aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20 aria-[invalid=true]:focus:border-red-600 aria-[invalid=true]:focus:ring-2 aria-[invalid=true]:focus:ring-red-500/25 aria-[invalid=true]:focus-visible:border-red-600 aria-[invalid=true]:focus-visible:ring-2 aria-[invalid=true]:focus-visible:ring-red-500/25 dark:aria-[invalid=true]:focus:ring-red-900",
        "aria-invalid:border-red-500 aria-invalid:ring-red-500/20 aria-invalid:focus:border-red-600 aria-invalid:focus:ring-2 aria-invalid:focus:ring-red-500/25 aria-invalid:focus-visible:border-red-600 aria-invalid:focus-visible:ring-2 aria-invalid:focus-visible:ring-red-500/25",
        "disabled:cursor-not-allowed disabled:opacity-60",
        isPassword && !hideToggle ? "pr-10" : "",
        className,
      )}
      type={inputType}
      {...props}
    />
    {isPassword && !hideToggle && (
      <button
        type="button"
        onClick={() => setShowPassword(!showPassword)}
        className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 rounded transition-colors cursor-pointer"
        aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
        aria-pressed={showPassword}
        aria-controls={props.id}
      >
        {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
      </button>
    )}
    </div>
  );
});
