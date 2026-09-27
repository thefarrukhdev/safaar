"use client";

import { useEffect, useRef, useState } from "react";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

export function TimePicker({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (time: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Parse current value
  const [hStr, mStr] = (value || "19:00").split(":");
  const currentHour = parseInt(hStr || "19", 10);
  const currentMin = parseInt(mStr || "00", 10);

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

  const hours = Array.from({ length: 24 }, (_, i) => i);
  // Options: 00, 15, 30, 45
  const minutes = [0, 15, 30, 45];

  const handleSelect = (h: number, m: number) => {
    const newH = String(h).padStart(2, "0");
    const newM = String(m).padStart(2, "0");
    onChange(`${newH}:${newM}`);
  };

  return (
    <div className={cn("relative w-full", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-primary-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white hover:bg-slate-50 dark:hover:bg-slate-700/50"
      >
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-400" />
          <span className="font-medium">{value || "19:00"}</span>
        </div>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 flex h-64 w-full origin-top gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl animate-in fade-in zoom-in-95 dark:border-slate-700 dark:bg-slate-800">
          
          <div className="flex-1 overflow-y-auto no-scrollbar border-r border-slate-100 pr-1 dark:border-slate-700">
            <div className="sticky top-0 bg-white/90 backdrop-blur pb-1 mb-1 text-[10px] font-bold text-slate-400 uppercase text-center dark:bg-slate-800/90 z-10">Soat</div>
            <div className="flex flex-col gap-1">
              {hours.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleSelect(h, currentMin)}
                  className={cn(
                    "rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-700",
                    h === currentHour
                      ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                      : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  {String(h).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar pl-1">
            <div className="sticky top-0 bg-white/90 backdrop-blur pb-1 mb-1 text-[10px] font-bold text-slate-400 uppercase text-center dark:bg-slate-800/90 z-10">Daqiqa</div>
            <div className="flex flex-col gap-1">
              {minutes.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleSelect(currentHour, m)}
                  className={cn(
                    "rounded-lg px-2 py-2 text-sm font-medium transition-colors hover:bg-slate-100 dark:hover:bg-slate-700",
                    m === currentMin
                      ? "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300"
                      : "text-slate-700 dark:text-slate-300"
                  )}
                >
                  {String(m).padStart(2, "0")}
                </button>
              ))}
            </div>
          </div>
          
        </div>
      )}
    </div>
  );
}
