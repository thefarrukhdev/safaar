"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { NavItem } from "./types";

export function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function DesktopNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="hidden md:flex items-center gap-1">
      {items.map((item) => {
        const active = isActive(pathname, item.href, item.exact);

        // Functional Minimalism style: 
        // No heavy backgrounds, just clean text colors, and maybe a subtle hover background or underline
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center rounded-lg px-3.5 py-2 text-[15px] font-bold transition-all duration-200",
              active
                ? "text-primary-600 bg-primary-50 dark:bg-primary-950/50 dark:text-primary-400 group-data-[transparent=true]/header:text-white group-data-[transparent=true]/header:bg-white/20"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white group-data-[transparent=true]/header:text-white/90 group-data-[transparent=true]/header:hover:text-white group-data-[transparent=true]/header:hover:bg-white/10"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
