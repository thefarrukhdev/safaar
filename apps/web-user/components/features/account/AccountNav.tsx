"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Locale } from "@/i18n/config";
import type { AccountDict } from "@/i18n/dictionaries";
import { cn } from "@/lib/cn";

/**
 * Kabinet navigatsiyasi. Joriy `usePathname` orqali aktiv tabni aniqlaydi
 * (LocaleSwitcher patterni). Mobil-friendly: kichik ekranda yonma-yon scroll.
 */
export function AccountNav({
  locale,
  dict,
}: {
  locale: Locale;
  dict: AccountDict["nav"];
}) {
  const pathname = usePathname();
  const base = `/${locale}/account`;

  const links = [
    { href: base, label: dict.profile },
    { href: `${base}/bookings`, label: dict.bookings },
    { href: `${base}/favorites`, label: dict.favorites },
    { href: `${base}/bonuses`, label: dict.bonuses },
  ];

  function isActive(href: string): boolean {
    if (href === base) {
      return pathname === base || pathname === `${base}/`;
    }
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <nav
      aria-label="Kabinet bo'limlari"
      className="-mx-1 flex gap-1 overflow-x-auto pb-1"
    >
      {links.map((link) => {
        const active = isActive(link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100",
              active
                ? "bg-slate-900/[0.05] text-slate-900"
                : "text-slate-600 hover:bg-slate-900/[0.08]"
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
