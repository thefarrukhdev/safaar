"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { PT_TYPES, PT_ICONS } from "./constants";
import type { PropertyType } from "./types";

interface Props {
 activeType: PropertyType;
 onChange: (type: PropertyType) => void;
 labels: Record<PropertyType, string>;
}

export function PropertyTypeTabs({ activeType, onChange, labels }: Props) {
 const idx = PT_TYPES.indexOf(activeType);

 function prev() {
 const i = (idx - 1 + PT_TYPES.length) % PT_TYPES.length;
 onChange(PT_TYPES[i]);
 }

 function next() {
 const i = (idx + 1) % PT_TYPES.length;
 onChange(PT_TYPES[i]);
 }

 return (
 <>
 {/* ═══ Desktop: row ═══ */}
 <div className="hidden items-center gap-1.5 sm:flex">
 {PT_TYPES.map((type) => (
 <button
 key={type}
 type="button"
 onClick={() => onChange(type)}
 className={`inline-flex items-center justify-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 active:scale-95 ${
 activeType === type
 ? "bg-blue-600 text-white shadow-sm"
 : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
 }`}
 >
 <span className="text-sm">{PT_ICONS[type]}</span>
 <span>{labels[type]}</span>
 </button>
 ))}
 </div>

 {/* ═══ Mobil: slider ═══ */}
 <div className="flex items-center justify-center gap-3 sm:hidden">
 <button
 type="button"
 onClick={prev}
 className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 active:scale-90"
 aria-label="Oldingi"
 >
 <ChevronLeft className="h-5 w-5" />
 </button>

 <div className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm">
 <span>{PT_ICONS[activeType]}</span>
 <span>{labels[activeType]}</span>
 </div>

 <button
 type="button"
 onClick={next}
 className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 active:scale-90"
 aria-label="Keyingi"
 >
 <ChevronRight className="h-5 w-5" />
 </button>
 </div>
 </>
 );
}
