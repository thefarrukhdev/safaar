"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { ChevronLeft, X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "../../_lib/utils/cn";
import { useUiStore } from "../../_stores/ui-store";
import { useAuthStore } from "../../_stores/auth-store";
import { Tooltip } from "../ui/tooltip";
import { getNavGroups } from "./sidebar-nav";

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const partnerType = user?.partnerType || "hotel";
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggle = useUiStore((s) => s.toggleSidebar);
  const mobileOpen = useUiStore((s) => s.mobileSidebarOpen);
  const closeMobile = useUiStore((s) => s.closeMobileSidebar);

  // Esc bilan mobile drawer yopilsin
  useEffect(() => {
    if (!mobileOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeMobile();
    };
    document.addEventListener("keydown", onEsc);
    return () => document.removeEventListener("keydown", onEsc);
  }, [mobileOpen, closeMobile]);

  // Marshrut o'zgarganda mobile drawer'ni yop
  useEffect(() => {
    closeMobile();
  }, [pathname, closeMobile]);

  return (
    <>
      {/* Mobile backdrop */}
      {mobileOpen && (
        <button
          type="button"
          onClick={closeMobile}
          aria-label="Menyu yopish"
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
        />
      )}

      <aside
        className={cn(
          "z-50 flex h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--surface)] transition-all duration-200",
          // Desktop
          "md:sticky md:top-0",
          collapsed ? "md:w-16" : "md:w-60",
          // Mobile
          "fixed left-0 top-0 w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
        )}
        aria-label="Asosiy navigatsiya"
      >
        {/* Header */}
        <div
          className={cn(
            "flex h-14 items-center border-b border-[var(--border)] transition-all duration-200",
            collapsed && !mobileOpen
              ? "justify-between px-1.5"
              : "justify-between px-3",
          )}
        >
          <Link
            href="/"
            className="flex items-center gap-2 overflow-hidden min-w-0"
            aria-label="Safaar bosh sahifa"
          >
            {collapsed && !mobileOpen ? (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md overflow-hidden">
                <Image
                  src="/icon.png"
                  alt="Safaar"
                  width={28}
                  height={28}
                  priority
                  className="h-6 w-6 object-contain"
                />
              </div>
            ) : (
              <div className="flex flex-col justify-center min-w-0 py-0.5">
                <Image
                  src="/logo.png"
                  alt="Safaar"
                  width={96}
                  height={36}
                  priority
                  className="h-6 w-auto object-contain"
                />
                <span className="text-[10px] uppercase font-semibold tracking-wider text-[var(--muted-foreground)] truncate mt-0.5">
                  {partnerType === "dacha"
                    ? "Dacha egasi"
                    : partnerType === "bus"
                      ? "Tashuvchi"
                      : partnerType === "hostel"
                        ? "Hostel"
                        : partnerType === "restaurant"
                          ? "Restoran egasi"
                          : "Hamkor"}
                </span>
              </div>
            )}
          </Link>

          {/* Desktop yig'ish/ochish tugmasi */}
          <Tooltip content={collapsed ? "Panel ochish" : "Panel yopish"}>
            <button
              type="button"
              onClick={toggle}
              aria-label={collapsed ? "Panel ochish" : "Panel yopish"}
              className={cn(
                "hidden shrink-0 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-[var(--surface-muted)] md:inline-flex",
                collapsed && !mobileOpen ? "h-7 w-7" : "h-8 w-8",
              )}
            >
              <ChevronLeft
                className={cn(
                  "h-4 w-4 transition-transform",
                  collapsed && "rotate-180",
                )}
                aria-hidden
              />
            </button>
          </Tooltip>

          {/* Mobile yopish tugmasi */}
          <button
            type="button"
            onClick={closeMobile}
            aria-label="Menyu yopish"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-[var(--surface-muted)] md:hidden"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3">
          <ul className="flex flex-col gap-4">
            {getNavGroups(partnerType).map((group, gi) => (
              <li key={gi} className="flex flex-col gap-1">
                {group.title && (!collapsed || mobileOpen) && (
                  <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                    {group.title}
                  </p>
                )}
                <ul className="flex flex-col gap-0.5">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = item.icon;
                    const showText = !collapsed || mobileOpen;
                    return (
                      <li key={item.href}>
                        <Tooltip content={!showText ? item.label : ""}>
                          <Link
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                              active
                                ? "bg-brand-50 text-brand-800 dark:bg-brand-900/40 dark:text-brand-200"
                                : "text-zinc-600 hover:bg-[var(--surface-muted)] hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white",
                            )}
                          >
                            {active && (
                              <span
                                className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r bg-brand-700 dark:bg-brand-400"
                                aria-hidden
                              />
                            )}
                            <Icon className="h-4 w-4 shrink-0" aria-hidden />
                            {showText && (
                              <>
                                <span className="flex-1 truncate">
                                  {item.label}
                                </span>
                                {item.badge && (
                                  <span className="rounded-full bg-accent-100 px-1.5 py-0.5 text-[10px] font-semibold text-accent-700 dark:bg-accent-900/50 dark:text-accent-200">
                                    {item.badge}
                                  </span>
                                )}
                              </>
                            )}
                          </Link>
                        </Tooltip>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        {(!collapsed || mobileOpen) && (
          <div className="border-t border-[var(--border)] p-4 text-xs leading-tight text-[var(--muted-foreground)]">
            <p className="font-semibold text-[var(--foreground)]">
              Safaar Hamkor v0.1
            </p>
            <p>partner.safaar.uz</p>
          </div>
        )}
      </aside>
    </>
  );
}
