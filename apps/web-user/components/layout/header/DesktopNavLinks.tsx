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
              "flex items-center rounded-full px-3.5 py-2 text-[15px] font-bold transition-all duration-200",
              active
                ? "text-slate-900 bg-slate-50 group-data-[transparent=true]/header:text-white"
                : "text-slate-500 hover:text-slate-900 hover:bg-slate-50 group-data-[transparent=true]/header:text-white group-data-[transparent=true]/header:hover:text-white"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
