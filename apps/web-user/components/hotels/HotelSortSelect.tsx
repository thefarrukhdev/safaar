"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronDown } from "lucide-react";
import type { HotelsDict } from "@/i18n/dictionaries";

export function HotelSortSelect({ dict }: { dict: HotelsDict["sort"] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = searchParams.get("sort") ?? "";

  function onChange(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set("sort", value);
    else params.delete("sort");
    params.delete("page");
    const query = params.toString();
    router.push(`${pathname}${query ? `?${query}` : ""}`);
  }

  return (
    <div className="relative inline-block w-full sm:w-auto">
      <select
        value={current}
        onChange={(e) => onChange(e.target.value)}
        aria-label={dict.label}
        className="appearance-none inline-flex h-10 max-md:h-11 w-full sm:w-auto min-w-[200px] items-center justify-between gap-2 rounded-full border border-slate-900/[0.06] bg-slate-900/[0.05] pl-5 pr-10 text-sm font-medium text-slate-900 shadow-emboss-alpha transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-900/[0.08] active:scale-[0.97] active:bg-slate-900/[0.12] active:shadow-emboss-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100"
      >
        <option value="">{dict.default}</option>
        <option value="price_asc">{dict.priceAsc}</option>
        <option value="price_desc">{dict.priceDesc}</option>
        <option value="rating">{dict.rating}</option>
      </select>
      <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-900/70" aria-hidden="true" />
    </div>
  );
}
