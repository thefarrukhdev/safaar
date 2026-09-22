import React, { useId } from "react";
import { cn } from "@/lib/utils";

export interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ElementType;
  rightElement?: React.ReactNode;
  error?: string | boolean;
}

export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, icon: Icon, rightElement, error, className, id, required, disabled, ...props }, ref) => {
    const defaultId = useId();
    const inputId = id || defaultId;
    const hasError = Boolean(error);
    const errorText = typeof error === "string" ? error : undefined;

    return (
      <div className={cn("space-y-1.5 w-full", disabled && "opacity-60")}>
        <div className="flex justify-between items-center pl-1">
          <label htmlFor={inputId} className="text-xs font-bold text-slate-700 select-none cursor-pointer">
            {label}
            {required && <span className="text-red-500 ml-0.5" aria-hidden="true">*</span>}
          </label>
        </div>
        
        <div className="relative group flex items-center">
          {Icon && (
            <Icon 
              className={cn(
                "absolute left-3.5 w-5 h-5 transition-colors duration-200 pointer-events-none z-10",
                hasError ? "text-red-500" : "text-slate-400 group-focus-within:text-primary-600"
              )} 
              aria-hidden="true" 
            />
          )}
          
          <input
            id={inputId}
            ref={ref}
            required={required}
            disabled={disabled}
            aria-invalid={hasError ? "true" : "false"}
            aria-describedby={errorText ? `${inputId}-error` : undefined}
            className={cn(
              "w-full bg-slate-50 hover:bg-slate-100/50 border rounded-xl py-3 text-sm text-slate-900 transition-all duration-200 shadow-sm",
              "placeholder:text-slate-400 placeholder:select-none",
              "focus:outline-none focus:bg-white focus:ring-4 focus:ring-primary-500/10",
              Icon ? "pl-11" : "pl-4",
              rightElement ? "pr-11" : "pr-4",
              hasError 
                ? "border-red-300 focus:border-red-500 focus:ring-red-500/10 text-red-900 placeholder:text-red-300"
                : "border-slate-200 focus:border-primary-500",
              disabled && "cursor-not-allowed bg-slate-100 hover:bg-slate-100",
              className
            )}
            {...props}
          />
          
          {rightElement && (
            <div className="absolute right-3 z-10">
              {rightElement}
            </div>
          )}
        </div>

        {errorText && (
          <p id={`${inputId}-error`} className="text-[13px] font-medium text-red-500 pl-1 animate-in fade-in slide-in-from-top-1">
            {errorText}
          </p>
        )}
      </div>
    );
  }
);

AuthInput.displayName = "AuthInput";
