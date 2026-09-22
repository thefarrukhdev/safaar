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
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-label={"Menyuni ochish"}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-slate-100 active:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800 group-data-[transparent=true]/header:text-white group-data-[transparent=true]/header:hover:bg-white/10"
        >
          <Menu className="h-6 w-6" />
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
            className="fixed inset-y-0 right-0 z-[110] flex h-[100dvh] w-full max-w-[320px] flex-col overflow-y-auto bg-white shadow-2xl animate-in slide-in-from-right duration-300 dark:bg-slate-900"
          >
            {/* Header */}
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95">
              <span className="text-base font-black tracking-tight text-slate-900 dark:text-white">
                {MENU_LABEL[currentLocale] ?? "Menyu"}
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                aria-label="Yopish"
              >
                <X className="h-4 w-4" />
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
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "group flex h-14 items-center justify-between w-full rounded-2xl px-4 text-[15px] font-bold transition-all duration-150 active:scale-[0.98]",
                        active
                          ? "bg-slate-900/[0.05] text-slate-900 dark:bg-primary-950/40 dark:text-primary-400"
                          : "text-slate-700 hover:bg-slate-900/[0.03] hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-800/80 dark:hover:text-white"
                      )}
                    >
                      <div className="flex items-center gap-3.5">
                        {item.icon && (
                          <span
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-xl transition-colors duration-150",
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

              <div className="my-6 h-px w-full bg-slate-100 dark:bg-slate-800" />

              {/* Locale Switcher */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/50">
                <div className="flex items-center gap-2 mb-3">
                  {isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary-600" />
                  ) : (
                    <Globe className="h-4 w-4 text-slate-400" />
                  )}
                  <span className="text-[13px] font-bold uppercase tracking-wider text-slate-500">
                    {LANG_LABEL[currentLocale] ?? "Til"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {locales.map((loc) => {
                    const active = loc === currentLocale;
                    return (
                      <button
                        key={loc}
                        type="button"
                        disabled={isPending}
                        onClick={() => switchLocale(loc)}
                        className={cn(
                          "flex flex-col items-center justify-center rounded-xl py-2.5 px-1 text-center transition-all duration-150 active:scale-95",
                          active
                            ? "bg-primary-600 text-white shadow-sm ring-1 ring-primary-600 ring-offset-2 dark:ring-offset-slate-900"
                            : "bg-white text-slate-700 border border-slate-200 hover:border-primary-300 hover:text-primary-700 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                        )}
                      >
                        <span className="text-[12px] font-black uppercase tracking-wider">
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
