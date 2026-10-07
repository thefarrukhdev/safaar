import * as React from"react";
import { cn } from"@/lib/utils";

export interface SectionHeaderProps {
 /** Section sarlavhasi */
 title: React.ReactNode;
 /** Qisqa tavsif (ixtiyoriy) */
 subtitle?: React.ReactNode;
 /** O'ng tomonidagi"Hammasi →"kabi harakat tugmasi */
 action?: React.ReactNode;
 /** Qo'shimcha CSS klasslari */
 className?: string;
 /** Badge (masalan:"Yangi","Premium") */
 badge?: React.ReactNode;
}

/**
 * DRY SectionHeader — Barcha bosh sahifa bo'limlari uchun yagona komponent.
 * Dizayn system: Manrope H2, Warm Neutral subtitle, Lapis Blue badge.
 */
export function SectionHeader({ title, subtitle, action, badge, className }: SectionHeaderProps) {
 return (
 <div
 className={cn(
"mb-6 flex flex-col items-start justify-between gap-4 sm:mb-8 sm:flex-row sm:items-end",
 className,
 )}
 >
 <div className="flex flex-col gap-1.5 sm:gap-2">
 {/* H2 — Manrope 800, design system scale */}
 <h2
 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl"
 style={{ fontFamily:"var(--font-manrope, sans-serif)", letterSpacing:"-0.02em"}}
 >
 {title}
 </h2>

 {/* Subtitle — Inter 400, Warm Neutral */}
 {subtitle && (
 <p className="max-w-xl text-sm font-medium leading-relaxed text-slate-500 sm:text-base">
 {subtitle}
 </p>
 )}
 </div>

 {/* Action (right side) */}
 {action && <div className="shrink-0">{action}</div>}
 </div>
 );
}
