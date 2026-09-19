"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export type SwitchProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => {
    return (
      <label
        className={cn(
          "group relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full",
          "focus-within:border-primary-600 focus-within:outline-none focus-within:ring-1 focus-within:ring-primary-600",
          className
        )}
      >
        <input
          type="checkbox"
          role="switch"
          ref={ref}
          className="peer sr-only"
          {...props}
        />
        <div className="pointer-events-none h-6 w-11 rounded-full bg-slate-900/[0.12] transition-colors duration-200 ease-[cubic-bezier(0.2,0,0,1)] peer-checked:bg-primary-600 peer-disabled:cursor-not-allowed peer-disabled:opacity-40" />
        <div
          className="pointer-events-none absolute left-0.5 h-5 w-5 translate-x-0 rounded-full border border-slate-900/[0.08] bg-white shadow-float transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] peer-checked:translate-x-5"
        />
      </label>
    );
  }
);
Switch.displayName = "Switch";
