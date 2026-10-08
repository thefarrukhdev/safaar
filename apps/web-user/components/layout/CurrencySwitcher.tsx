"use client";

import { ThinkingOrb } from "@/components/ui/thinking-orb";

import { useState, useRef, useEffect, useTransition } from"react";
import { Coins } from"lucide-react";
import { cn } from"@/lib/cn";
import { buttonVariants } from"@/components/ui/button-variants";
import { useCurrency } from"@/components/providers/CurrencyProvider";
import { CURRENCY_INFO, type CurrencyCode } from"@/lib/utils/money";

export function CurrencySwitcher({ light = false }: { light?: boolean }) {
 const { currency, setCurrency } = useCurrency();
 const [open, setOpen] = useState(false);
 const [isPending, startTransition] = useTransition();
 const ref = useRef<HTMLDivElement>(null);

 useEffect(() => {
 function handleKeyDown(e: KeyboardEvent) {
 if (e.key ==="Escape") setOpen(false);
 }
 function handleClick(e: MouseEvent) {
 if (ref.current && !ref.current.contains(e.target as Node)) {
 setOpen(false);
 }
 }
 if (open) {
 document.addEventListener("mousedown", handleClick);
 document.addEventListener("keydown", handleKeyDown);
 }
 return () => {
 document.removeEventListener("mousedown", handleClick);
 document.removeEventListener("keydown", handleKeyDown);
 };
 }, [open]);

 function switchCurrency(nextCurrency: CurrencyCode) {
 if (nextCurrency === currency) {
 setOpen(false);
 return;
 }
 setOpen(false);
 startTransition(() => {
 setCurrency(nextCurrency);
 });
 }

 return (
 <div ref={ref} className="relative inline-block text-left">
 <button
 type="button"
 onClick={() => setOpen((v) => !v)}
 disabled={isPending}
 aria-haspopup="listbox"
 aria-expanded={open}
 aria-label="Valyutani tanlash"
 className={buttonVariants({
 variant:"secondary",
 className: cn("!h-10 min-h-[40px] px-3.5 text-[14px] font-bold gap-1.5 cursor-pointer group-data-[transparent=true]/header:bg-white/10 group-data-[transparent=true]/header:text-white group-data-[transparent=true]/header:border-white/20 group-data-[transparent=true]/header:hover:bg-white/20", isPending &&"opacity-70 cursor-not-allowed"),
 })}
 >
 {isPending ? (
 <ThinkingOrb size={16} state="base" />
 ) : (
 <span className="text-[16px] leading-none"aria-hidden>{CURRENCY_INFO[currency].symbol}</span>
 )}
 <span className="font-bold uppercase tracking-wide">
 {currency}
 </span>
 </button>

 {open && (
 <div
 role="listbox"
 aria-label="Valyutalar"
 className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-slate-200 bg-white p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
 >
 {(Object.keys(CURRENCY_INFO) as CurrencyCode[]).map((loc) => {
 const active = loc === currency;
 const info = CURRENCY_INFO[loc];
 return (
 <button
 key={loc}
 type="button"
 role="option"
 aria-selected={active}
 onClick={() => switchCurrency(loc)}
 className={cn(
 "flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm font-semibold transition-all duration-200 ease-out active:scale-[0.97]",
 active
 ?"bg-slate-50 text-blue-600"
 :"text-slate-500 hover:bg-slate-50 hover:text-slate-900",
 )}
 >
 <div className="flex items-center gap-2">
 <span>{info.flag}</span>
 <span>{info.code}</span>
 </div>
 <span className={cn("text-[11px] font-bold tracking-wider", active ?"opacity-100":"opacity-60")}>
 {info.symbol}
 </span>
 </button>
 );
 })}
 </div>
 )}
 </div>
 );
}
