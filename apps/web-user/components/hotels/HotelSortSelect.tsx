"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { HotelsDict } from "@/i18n/dictionaries";
import { Select } from "@/components/ui/Select";

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
      <Select
        value={current}
        onChange={onChange}
        ariaLabel={dict.label}
        buttonClassName="h-10 max-md:h-11 w-full sm:w-auto min-w-0 sm:min-w-[200px] rounded-full border border-slate-900/[0.06] bg-slate-900/[0.05] hover:bg-slate-900/[0.08] dark:border-slate-800 dark:bg-slate-800 dark:hover:bg-slate-700 text-sm font-medium"
        options={[
          { value: "", label: dict.default },
          { value: "price_asc", label: dict.priceAsc },
          { value: "price_desc", label: dict.priceDesc },
          { value: "rating", label: dict.rating },
        ]}
      />
    </div>
  );
}
