import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
}

export function Input({ className, error, ...props }: InputProps) {
  const hasError = Boolean(error);
  return (
    <div className="flex w-full flex-col gap-1">
      <input
        aria-invalid={hasError || undefined}
        className={cn(
          "h-12 w-full rounded-xl border border-slate-900/50 bg-white px-4 text-base text-slate-900",
          "placeholder:text-slate-900/60",
          "transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          "hover:border-slate-900/70",
          "focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600",
          "aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus:ring-red-600",
          "disabled:opacity-40 motion-reduce:transition-none",
          className
        )}
        {...props}
      />
      {typeof error === "string" && error.length > 0 && (
        <span role="alert" className="text-xs font-medium text-red-600">
          {error}
        </span>
      )}
    </div>
  );
}
