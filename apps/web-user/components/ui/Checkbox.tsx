"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  description?: string;
}

export function Checkbox({ className, label, description, ...props }: CheckboxProps) {
  return (
    <label className={cn("group flex items-start gap-3 cursor-pointer", className)}>
      <div className="relative flex items-center justify-center">
        <input
          type="checkbox"
          className={cn(
            "peer h-5 w-5 cursor-pointer appearance-none rounded-[4px] border border-slate-900/50 bg-white",
            "transition-[background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
            "hover:border-slate-900/70",
            "checked:border-primary-600 checked:bg-primary-600",
            "focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-600",
            "disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none"
          )}
          {...props}
        />
        <Check className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 transition-opacity peer-checked:opacity-100" />
      </div>
      {(label || description) && (
        <div className="flex flex-col">
          {label && (
            <span className="text-sm text-slate-900 transition-transform active:scale-[0.99]">
              {label}
            </span>
          )}
          {description && (
            <span className="text-xs text-slate-900/70">
              {description}
            </span>
          )}
        </div>
      )}
    </label>
  );
}
