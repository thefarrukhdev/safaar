"use client";

import { useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { locales, localeNames, type Locale } from "@/i18n/config";
import { FluidDropdown } from "@/components/ui/FluidDropdown";
import { ThinkingOrb } from "@/components/ui/thinking-orb";

export function LocaleSwitcher({
  current,
  light = false,
}: {
  current: Locale;
  light?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const pathname = usePathname();
  const router = useRouter();

  function switchLocale(nextLocale: string) {
    if (nextLocale === current) return;
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

  const items = locales.map((loc) => ({
    value: loc,
    label: localeNames[loc],
    description: loc.toUpperCase(),
  }));

  return (
    <FluidDropdown
      value={current}
      onChange={switchLocale}
      items={items}
      triggerLabel={<span className="font-bold uppercase tracking-wide">{current}</span>}
      icon={
        isPending ? (
          <ThinkingOrb size={16} state="base" />
        ) : (
          <Globe className="h-[18px] w-[18px]" aria-hidden />
        )
      }
      disabled={isPending}
      align="right"
      ariaLabel="Tilni tanlash"
      menuClassName="w-44"
      buttonClassName="!h-10 min-h-[40px] px-3.5 text-[14px] font-bold gap-1.5 cursor-pointer backdrop-blur-md transition-all group-data-[transparent=true]/header:bg-white/15 group-data-[transparent=true]/header:text-white group-data-[transparent=true]/header:border-white/30 group-data-[transparent=true]/header:hover:bg-white/25 group-data-[transparent=true]/header:hover:border-white/40"
    />
  );
}
