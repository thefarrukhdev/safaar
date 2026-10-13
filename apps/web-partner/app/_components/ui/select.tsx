"use client";

import { forwardRef, type SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../_lib/utils/cn";

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { className, children, error, ...props },
  ref,
) {
  return (
    <div className="relative w-full">
      <select
        ref={ref}
        aria-invalid={error ? true : props["aria-invalid"]}
        className={cn(
          "h-10 w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 pr-10 text-sm text-slate-900 shadow-2xs",
          "transition-all duration-150 cursor-pointer",
          "hover:border-slate-300 hover:bg-slate-100/50",
          "focus:border-blue-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20",
          "focus-visible:border-blue-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25",
          "aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20 aria-[invalid=true]:focus:border-red-600 aria-[invalid=true]:focus:ring-red-500/25",
          "aria-invalid:border-red-500 aria-invalid:ring-red-500/20 aria-invalid:focus:border-red-600 aria-invalid:focus:ring-red-500/25",
          "disabled:cursor-not-allowed disabled:opacity-60",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
    </div>
  );
});
