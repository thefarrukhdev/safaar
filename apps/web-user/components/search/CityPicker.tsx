"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import type { CityOption } from "@/types/view";

interface Props {
  cities: CityOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
}

export function CityPicker({ cities, value, onChange, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = cities.find((c) => c.id === value);

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
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

  return (
    <div ref={ref} className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-1 text-left focus:outline-hidden before:absolute before:inset-0 before:z-10"
      >
        <span
          className={`truncate text-base font-bold ${
            selected ? "text-slate-900" : "text-slate-600"
          }`}
        >
          {selected ? selected.name : placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[240px] max-h-60 overflow-y-auto rounded-xl border border-slate-900/[0.08] bg-white p-1.5 shadow-float dark:border-slate-800 dark:bg-slate-900">
          {cities.length === 0 && (
            <p className="px-3 py-4 text-center text-sm font-medium text-slate-500">—</p>
          )}
          {cities.map((city) => (
            <button
              key={city.id}
              type="button"
              onClick={() => {
                onChange(city.id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-bold transition-colors ${
                city.id === value
                  ? "bg-blue-600/[0.10] text-blue-700"
                  : "text-slate-800 hover:bg-slate-900/[0.03]"
              }`}
            >
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary-600" />
              <span>{city.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
