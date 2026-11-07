"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { HotelsDict } from "@/i18n/dictionaries";
import { FluidDropdown } from "@/components/ui/FluidDropdown";

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
      <FluidDropdown
        value={current}
        onChange={onChange}
        ariaLabel={dict.label}
        className="w-full sm:w-auto"
        buttonClassName="h-10 max-md:h-11 w-full sm:w-auto min-w-0 sm:min-w-[200px]"
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
