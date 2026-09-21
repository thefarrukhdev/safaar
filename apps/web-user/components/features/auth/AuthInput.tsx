import React from "react";

export interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon?: React.ElementType;
  rightElement?: React.ReactNode;
}

export const AuthInput = React.forwardRef<HTMLInputElement, AuthInputProps>(
  ({ label, icon: Icon, rightElement, ...props }, ref) => (
    <div className="space-y-1">
      <div className="flex justify-between items-center pl-1">
        <label className="text-xs font-bold text-slate-700">{label}</label>
      </div>
      <div className="relative group">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-primary-600 transition-colors" />
        )}
        <input
          ref={ref}
          className={`w-full bg-white border border-slate-200 rounded-xl py-3 ${
            Icon ? "pl-10" : "pl-4"
          } pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all shadow-sm`}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {rightElement}
          </div>
        )}
      </div>
    </div>
  )
);
AuthInput.displayName = "AuthInput";
