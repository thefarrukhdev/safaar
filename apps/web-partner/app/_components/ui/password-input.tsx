"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "../../_lib/utils/cn";
import { Input } from "./input";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export const PasswordInput = forwardRef<HTMLInputElement, InputProps>(
  function PasswordInput({ className, ...props }, ref) {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <div className="relative w-full">
        <Input
          ref={ref}
          type={showPassword ? "text" : "password"}
          hideToggle
          className={cn("pr-10", className)}
          {...props}
        />
        <button
          type="button"
          onClick={() => setShowPassword((prev) => !prev)}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 rounded transition-colors cursor-pointer"
          aria-label={showPassword ? "Parolni yashirish" : "Parolni ko'rsatish"}
          aria-pressed={showPassword}
          aria-controls={props.id}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  }
);

