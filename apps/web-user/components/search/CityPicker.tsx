"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";
import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import type { CityOption } from "@/types/view";

interface Props {
  cities: CityOption[];
  value: string;
  onChange: (id: string) => void;
  placeholder: string;
  label?: string;
}

export function CityPicker({ cities, value, onChange, placeholder, label }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = cities.find((c) => c.id === value);
  const prefersReducedMotion = usePrefersReducedMotion();

  const [highlight, setHighlight] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    visible: boolean;
  }>({ x: 0, y: 0, width: 0, height: 0, visible: false });

  useEffect(() => {
    if (!open) return;
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setHighlight((prev) => ({ ...prev, visible: false }));
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setHighlight((prev) => ({ ...prev, visible: false }));
      }
    }
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleItemHover = (el: HTMLElement) => {
    setHighlight({
      x: el.offsetLeft,
      y: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
      visible: true,
    });
  };

  return (
    <div ref={ref} className="w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-1 text-left focus:outline-hidden before:absolute before:inset-0 before:z-10"
      >
        <span className="flex flex-col">
          {label && <span className="text-xs font-bold text-slate-500">{label}</span>}
          <span
            className={`truncate text-sm font-bold ${
              selected ? "text-slate-900" : "text-slate-600"
            }`}
          >
            {selected ? selected.name : placeholder}
          </span>
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-500 transition-transform duration-200 ${
            open ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </button>

      {open && (
        <div
          onMouseLeave={() => setHighlight((prev) => ({ ...prev, visible: false }))}
          className="absolute left-0 top-full z-[100] mt-2 w-full sm:w-[320px] max-h-[40vh] sm:max-h-60 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95"
        >
          <div className="relative flex flex-col gap-0.5">
            {/* Fluid Floating Pill on Hover */}
            {!prefersReducedMotion && (
              <motion.div
                aria-hidden="true"
                initial={false}
                animate={{
                  x: highlight.x,
                  y: highlight.y,
                  width: highlight.width,
                  height: highlight.height,
                  opacity: highlight.visible ? 1 : 0,
                }}
                transition={{
                  type: "spring",
                  stiffness: 550,
                  damping: 38,
                  mass: 0.6,
                  opacity: { duration: 0.12 },
                }}
                className="pointer-events-none absolute left-0 top-0 rounded-full bg-slate-100"
              />
            )}

            {cities.length === 0 && (
              <p className="px-3 py-4 text-center text-sm font-medium text-slate-500">—</p>
            )}

            {cities.map((city) => (
              <button
                key={city.id}
                type="button"
                onMouseEnter={(e) => handleItemHover(e.currentTarget)}
                onClick={() => {
                  onChange(city.id);
                  setOpen(false);
                  setHighlight((prev) => ({ ...prev, visible: false }));
                }}
                className={`relative z-10 flex w-full items-center gap-2 rounded-full px-3 py-2.5 text-left text-sm font-bold transition-colors cursor-pointer ${
                  city.id === value
                    ? "text-blue-600 font-semibold"
                    : "text-slate-900"
                }`}
              >
                <MapPin className="h-3.5 w-3.5 shrink-0 text-blue-600" />
                <span>{city.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
