"use client";

import * as React from "react";
import { cn } from "@/lib/cn";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-xl border border-slate-900/50 bg-white px-4 py-3 text-base text-slate-900",
          "placeholder:text-slate-900/60",
          "transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          "hover:border-slate-900/70",
          "focus:border-primary-600 focus:outline-none focus:ring-1 focus:ring-primary-600",
          "aria-[invalid=true]:border-red-600 aria-[invalid=true]:focus:ring-red-600",
          "disabled:cursor-not-allowed disabled:opacity-40 motion-reduce:transition-none",
          error && "border-red-600 focus:ring-red-600",
          className
        )}
        aria-invalid={error ? "true" : undefined}
        ref={ref}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
