import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean | string;
}

export function Input({ className, error, ...props }: InputProps) {
  const hasError = Boolean(error);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (props.type === "tel") {
      let val = e.target.value;
      // Ruxsat berilgan belgilar: raqamlar, probel, plyus, qavslar va chiziqcha
      val = val.replace(/[^\d\s+()-]/g, "");
      e.target.value = val;
    } else if (props.type === "number") {
      let val = e.target.value;
      // Ruxsat berilgan belgilar: raqamlar, nuqta, vergul va chiziqcha (manfiy sonlar uchun)
      val = val.replace(/[^\d.,-]/g, "");
      e.target.value = val;
    }
    props.onChange?.(e);
  };

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
          "disabled:opacity-40 disabled:cursor-not-allowed motion-reduce:transition-none",
          className
        )}
        {...props}
        onChange={handleChange}
      />
      {typeof error === "string" && error.length > 0 && (
        <span role="alert" className="text-[13px] font-medium text-red-600 pl-1 animate-in fade-in slide-in-from-top-1">
          {error}
        </span>
      )}
    </div>
  );
}
