"use client";

import { useState, useEffect, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X, ChevronRight, Globe, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { HeaderBrand } from "./HeaderBrand";
import { isActive } from "./DesktopNavLinks";
import type { HeaderProps } from "./types";
import { locales, localeNames, type Locale } from "@/i18n/config";

const MENU_LABEL: Record<string, string> = {
  uz: "Menyu",
  ru: "Меню",
  en: "Menu",
};
const LANG_LABEL: Record<string, string> = {
  uz: "Til",
  ru: "Язык",
  en: "Language",
};

export function MobileNav({ brand, brandHref, items, locale, authActions }: HeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const currentLocale = (locale ?? "uz") as Locale;

  // Body Scroll Lock for Mobile Drawer
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  // Keyboard Escape listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
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
          onClick={() => setMenuOpen((v) => !v)}
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Menyuni yopish" : "Menyuni ochish"}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {menuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {menuOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setMenuOpen(false)}
            aria-hidden
          />
          <nav
            aria-label="Mobil navigatsiya"
            className="fixed inset-x-4 top-20 z-50 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-xl animate-in fade-in slide-in-from-top-4 duration-200 dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Header */}
            <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                {MENU_LABEL[currentLocale] ?? "Menyu"}
              </span>
            </div>

            {/* Nav Links */}
            <div className="flex flex-col gap-1">
              {items.map((item) => {
                const active = isActive(pathname, item.href, item.exact);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex h-12 items-center justify-between w-full rounded-xl px-3 text-[15px] font-bold transition-all duration-150 active:scale-[0.98]",
                      active
                        ? "bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-400"
                        : "text-slate-700 hover:bg-slate-50 hover:text-slate-950 dark:text-slate-200 dark:hover:bg-slate-800/80 dark:hover:text-white"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {item.icon && (
                        <span
                          className={cn(
                            "flex h-8 w-8 items-center justify-center rounded-lg transition-colors duration-150",
                            active
                              ? "bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300"
                              : "bg-slate-100 text-slate-500 group-hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400"
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
                        active ? "text-primary-600 translate-x-0.5" : "text-slate-300 group-hover:text-slate-400"
                      )}
                    />
                  </Link>
                );
              })}
            </div>

            <hr className="my-4 border-slate-100 dark:border-slate-800" />

            {/* Locale Switcher — standalone, no header-group dependency */}
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
              <div className="flex items-center gap-2 mb-2">
                {isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                ) : (
                  <Globe className="h-4 w-4 text-slate-400" />
                )}
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {LANG_LABEL[currentLocale] ?? "Til"}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {locales.map((loc) => {
                  const active = loc === currentLocale;
                  return (
                    <button
                      key={loc}
                      type="button"
                      disabled={isPending}
                      onClick={() => switchLocale(loc)}
                      className={cn(
                        "flex flex-col items-center justify-center rounded-lg py-2 px-1 text-center transition-all duration-150 active:scale-95",
                        active
                          ? "bg-primary-600 text-white shadow-sm"
                          : "bg-white text-slate-700 border border-slate-200 hover:border-primary-300 hover:text-primary-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                      )}
                    >
                      <span className="text-[11px] font-black uppercase tracking-wider">
                        {loc}
                      </span>
                      <span className="text-[10px] font-medium opacity-75 mt-0.5 leading-tight">
                        {localeNames[loc]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Auth Actions */}
            {authActions && (
              <div className="flex flex-col gap-2 mt-3">
                {authActions}
              </div>
            )}
          </nav>
        </>
      )}
    </div>
  );
}
