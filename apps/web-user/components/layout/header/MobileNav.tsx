"use client";

import { ThinkingOrb } from "@/components/ui/thinking-orb";

import { useState, useEffect, useTransition } from"react";
import Link from"next/link";
import { usePathname, useRouter } from"next/navigation";
import { Menu, X, ChevronRight, Globe } from"lucide-react";
import { cn } from"@/lib/utils";
import { HeaderBrand } from"./HeaderBrand";
import { isActive } from"./DesktopNavLinks";
import type { HeaderProps } from"./types";
import { locales, localeNames, type Locale } from"@/i18n/config";

const MENU_LABEL: Record<string, string> = {
 uz:"Menyu",
 ru:"Меню",
 en:"Menu",
};
const LANG_LABEL: Record<string, string> = {
 uz:"Til",
 ru:"Язык",
 en:"Language",
};

export function MobileNav({ brand, brandHref, items, locale, authActions }: HeaderProps) {
 const pathname = usePathname();
 const router = useRouter();
 const [menuOpen, setMenuOpen] = useState(false);
 const [langOpen, setLangOpen] = useState(false);
 const [isPending, startTransition] = useTransition();
 const currentLocale = (locale ?? "uz") as Locale;

 // Body Scroll Lock for Mobile Drawer
 useEffect(() => {
 if (menuOpen) {
 document.body.style.overflow ="hidden";
 } else {
 document.body.style.overflow ="";
 }
 return () => {
 document.body.style.overflow ="";
 };
 }, [menuOpen]);

 // Keyboard Escape listener
 useEffect(() => {
 function handleKeyDown(e: KeyboardEvent) {
 if (e.key ==="Escape") setMenuOpen(false);
 }
 if (menuOpen) {
 window.addEventListener("keydown", handleKeyDown);
 }
 return () => window.removeEventListener("keydown", handleKeyDown);
 }, [menuOpen]);

 function switchLocale(nextLocale: Locale) {
 if (nextLocale === currentLocale) return;
 const segments = pathname.split("/").filter(Boolean);
 if (segments.length > 0 && (locales as readonly string[]).includes(segments[0])) {
 segments[0] = nextLocale;
 } else {
 segments.unshift(nextLocale);
 }
 const nextPath = `/${segments.join("/")}`;
 startTransition(() => {
 router.push(nextPath);
 });
 }

 return (
 <div className="md:hidden">
 <div className="flex items-center justify-between">
 <HeaderBrand href={brandHref} brand={brand} />
 <button
 type="button"
 onClick={() => setMenuOpen(true)}
 aria-expanded={menuOpen}
 aria-label={"Menyuni ochish"}
 className="flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition-all duration-200 ease-out hover:bg-slate-100 active:scale-[0.97] group-data-[transparent=true]/header:text-white group-data-[transparent=true]/header:hover:bg-white/10"
 >
 <Menu className="h-6 w-6"/>
 </button>
 </div>

 {menuOpen && (
 <>
 <div
 className="fixed inset-0 z-[100] bg-slate-900/60 transition-opacity animate-in fade-in duration-300"
 onClick={() => setMenuOpen(false)}
 aria-hidden
 />
 <nav
 aria-label="Mobil navigatsiya"
 className="fixed inset-y-0 right-0 z-[110] flex h-[100dvh] w-full max-w-[320px] flex-col overflow-y-auto bg-white animate-in slide-in-from-right duration-300"
 >
 {/* Header */}
 <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
 <span className="text-base font-black tracking-tight text-slate-900">
 {MENU_LABEL[currentLocale] ??"Menyu"}
 </span>
 <button
 type="button"
 onClick={() => setMenuOpen(false)}
 className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-all duration-200 ease-out hover:bg-slate-200 hover:text-slate-700 active:scale-[0.97]"
 aria-label="Yopish"
 >
 <X className="h-4 w-4"/>
 </button>
 </div>

 <div className="flex-1 px-5 py-6">
 {/* Nav Links */}
 <div className="flex flex-col gap-2">
 {items.map((item) => {
 const active = isActive(pathname, item.href, item.exact);
 return (
 <Link
 key={item.href}
 href={item.href}
 onClick={() => setMenuOpen(false)}
 aria-current={active ?"page": undefined}
 className={cn(
 "group flex h-14 items-center justify-between w-full rounded-2xl px-4 text-[15px] font-bold transition-all duration-200 ease-out active:scale-[0.97]",
 active
 ?"bg-slate-100 text-slate-900"
 :"text-slate-700 hover:bg-slate-50 hover:text-slate-900"
 )}
 >
 <div className="flex items-center gap-3.5">
 {item.icon && (
 <span
 className={cn(
"flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150",
 active
 ?"bg-blue-100 text-blue-700"
 :"bg-slate-100 text-slate-500 group-hover:bg-slate-200"
 )}
 >
 {item.icon}
 </span>
 )}
 <span>{item.label}</span>
 </div>
 <ChevronRight
 className={cn(
"h-4 w-4 transition-transform duration-150",
 active ?"text-blue-600 translate-x-0.5":"text-slate-300 group-hover:text-slate-400"
 )}
 />
 </Link>
 );
 })}
 </div>

 <div className="my-6 h-px w-full bg-slate-100"/>

 {/* Locale Switcher */}
 <div className="flex flex-col gap-1">
 <button
 type="button"
 onClick={() => setLangOpen(!langOpen)}
 className={cn(
 "group flex h-14 items-center justify-between w-full rounded-2xl px-4 text-[15px] font-bold transition-all duration-200 ease-out active:scale-[0.97]",
 langOpen
 ? "bg-slate-100 text-slate-900"
 : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
 )}
 >
 <div className="flex items-center gap-3.5">
 <span className={cn(
 "flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150",
 langOpen ? "bg-slate-200 text-slate-700" : "bg-slate-100 text-slate-500 group-hover:bg-slate-200"
 )}>
 {isPending ? <ThinkingOrb size={18} state="base" /> : <Globe className="h-[18px] w-[18px]"/>}
 </span>
 <span>{LANG_LABEL[currentLocale] ?? "Til"}</span>
 </div>
 <div className="flex items-center gap-2 text-slate-500">
 <span className="text-[13px] font-medium">{localeNames[currentLocale]}</span>
 <ChevronRight
 className={cn(
 "h-4 w-4 transition-transform duration-150",
 langOpen ? "rotate-90 text-slate-600" : "text-slate-300 group-hover:text-slate-400"
 )}
 />
 </div>
 </button>

 {langOpen && (
 <div className="animate-in slide-in-from-top-2 fade-in duration-200 flex flex-col gap-1 px-4 py-2 mb-2">
 {locales.map((loc) => {
 const active = loc === currentLocale;
 return (
 <button
 key={loc}
 type="button"
 disabled={isPending}
 onClick={() => {
 switchLocale(loc);
 setLangOpen(false);
 }}
 className={cn(
 "flex h-12 w-full items-center justify-between rounded-2xl px-4 text-[14px] font-semibold transition-all duration-200 ease-out active:scale-[0.97]",
 active
 ? "text-blue-600 bg-slate-50"
 : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
 )}
 >
 <span>{localeNames[loc]}</span>
 {active && <span className="flex h-1.5 w-1.5 rounded-full bg-blue-600" />}
 </button>
 );
 })}
 </div>
 )}
 </div>

 {/* Auth Actions */}
 {authActions && (
 <div className="mt-6 flex flex-col gap-3">
 {authActions}
 </div>
 )}
 </div>
 </nav>
 </>
 )}
 </div>
 );
}
