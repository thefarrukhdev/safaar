"use client";

import { ThinkingOrb } from "@/components/ui/thinking-orb";

import { useState, useRef, useEffect, useTransition } from"react";
import { usePathname, useRouter } from"next/navigation";
import { Globe } from"lucide-react";
import { locales, localeNames, type Locale } from"@/i18n/config";
import { cn } from"@/lib/cn";
import { buttonVariants } from"@/components/ui/button-variants";

export function LocaleSwitcher({
 current,
 light = false,
}: {
 current: Locale;
 light?: boolean;
}) {
 const [open, setOpen] = useState(false);
 const [isPending, startTransition] = useTransition();
 const ref = useRef<HTMLDivElement>(null);
 const pathname = usePathname();
 const router = useRouter();

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

 function switchLocale(nextLocale: Locale) {
 if (nextLocale === current) {
 setOpen(false);
 return;
 }
 const segments = pathname.split("/").filter(Boolean);
 if (segments.length > 0 && (locales as readonly string[]).includes(segments[0])) {
 segments[0] = nextLocale;
 } else {
 segments.unshift(nextLocale);
 }
 const nextPath = `/${segments.join("/")}`;
 setOpen(false);
 
 // UI"oq bo'lib qolmasligi"(loading.tsx ga o'tib ketmasligi) uchun startTransition ishlatamiz.
 startTransition(() => {
 router.push(nextPath);
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
 aria-label="Tilni tanlash"
 className={buttonVariants({
 variant:"secondary",
 
 className: cn("!h-10 min-h-[40px] px-3.5 text-[14px] font-bold gap-1.5 cursor-pointer group-data-[transparent=true]/header:bg-white/10 group-data-[transparent=true]/header:text-white group-data-[transparent=true]/header:border-white/20 group-data-[transparent=true]/header:hover:bg-white/20", isPending &&"opacity-70 cursor-not-allowed"),
 })}
 >
 {isPending ? (
 <ThinkingOrb size={16} state="base" />
 ) : (
 <Globe className="h-[18px] w-[18px] opacity-80"aria-hidden />
 )}
 <span className="font-bold uppercase tracking-wide">
 {current}
 </span>
 </button>

 {open && (
 <div
 role="listbox"
 aria-label="Tillar"
 className="absolute right-0 top-full mt-2 w-40 rounded-2xl border border-slate-200 bg-white p-1.5 z-50 animate-in fade-in zoom-in-95 duration-100"
 >
 {locales.map((loc) => {
 const active = loc === current;
 return (
 <button
 key={loc}
 type="button"
 role="option"
 aria-selected={active}
 onClick={() => switchLocale(loc)}
 className={cn(
"flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
 active
 ?"bg-blue-50 text-blue-700"
 :"text-slate-700 hover:bg-slate-100 hover:text-slate-900 :bg-slate-800 :text-white",
 )}
 >
 <span>{localeNames[loc]}</span>
 <span className={cn("uppercase text-[11px] font-bold tracking-wider", active ?"opacity-100":"opacity-60")}>
 {loc}
 </span>
 </button>
 );
 })}
 </div>
 )}
 </div>
 );
}

