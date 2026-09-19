"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";
import { buttonVariants } from "@/components/ui/button-variants";

export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder ?? "—";

  return (
    <div ref={ref} className={cn("relative w-full", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        className={cn(
          "flex h-12 w-full items-center justify-between rounded-xl border border-slate-900/50 bg-white px-4 text-base text-slate-900",
          "transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
          "hover:border-slate-900/70",
          "focus-visible:border-primary-600 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary-600"
        )}
      >
        <span className={cn("truncate", !selected && "text-slate-900/60")}>
          {display}
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-slate-900/70 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)]",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-full min-w-[11rem] rounded-xl border border-slate-900/[0.08] bg-white p-1.5 shadow-float motion-reduce:transition-none">
          {options.length === 0 && (
            <span className="block px-3 py-2 text-sm text-slate-900/70">—</span>
          )}
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
                className={cn(
                  "flex w-full items-center rounded-lg px-3 py-2 text-sm transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.98]",
                  active
                    ? "bg-slate-900/[0.08] font-medium text-slate-900"
                    : "text-slate-900 hover:bg-slate-900/[0.03]"
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
