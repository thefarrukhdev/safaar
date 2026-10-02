"use client";

import { useState, useRef, useEffect, ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/cn";

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
 buttonClassName,
 menuClassName,
 ariaLabel,
 label,
 icon,
}: {
 value: string;
 onChange: (value: string) => void;
 options: SelectOption[];
 placeholder?: string;
 className?: string;
 buttonClassName?: string;
 menuClassName?: string;
 ariaLabel?: string;
 label?: string;
 icon?: ReactNode;
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
 "group flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-card px-3.5 py-2.5 text-left transition-all hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ",
 buttonClassName
 )}
 >
 {icon && (
 <span className="shrink-0 text-slate-500 transition-colors group-hover:text-blue-600 :text-blue-400">
 {icon}
 </span>
 )}
 <span className="flex min-w-0 flex-1 flex-col">
 {label && (
 <span className="text-[11px] font-bold text-slate-500 ">{label}</span>
 )}
 <span className={cn("truncate text-xs font-bold", !selected && "text-slate-900/60 ", selected && "text-slate-900 ")}>
 {display}
 </span>
 </span>
 <ChevronDown
 className={cn(
 "h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200",
 open && "rotate-180 text-blue-500"
 )}
 aria-hidden
 />
 </button>

 {open && (
 <div className={cn(
 "absolute left-0 top-full mt-2 z-50 w-full min-w-[11rem] max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl animate-in fade-in zoom-in-95 ",
 menuClassName
 )}>
 {options.length === 0 && (
 <span className="block px-3 py-2 text-sm text-slate-900/70 ">—</span>
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
 "flex w-full items-center rounded-lg px-3 py-2 text-sm transition-colors",
 active
 ? "bg-blue-50 font-medium text-blue-700 "
 : "text-slate-700 hover:bg-slate-100 :bg-slate-700"
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
