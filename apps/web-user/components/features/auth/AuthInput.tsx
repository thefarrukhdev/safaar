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
        <label className="text-xs font-medium text-zinc-400">{label}</label>
      </div>
      <div className="relative group">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500 group-focus-within:text-blue-500 transition-colors" />
        )}
        <input
          ref={ref}
          className={`w-full bg-zinc-950/50 border border-zinc-800 rounded-xl py-3 ${
            Icon ? "pl-10" : "pl-4"
          } pr-10 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner`}
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
