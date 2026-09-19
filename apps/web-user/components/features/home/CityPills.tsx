"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { CityOption } from "@/types/view";
import type { Locale } from "@/i18n/config";

interface CityPillsProps {
  cities: CityOption[];
  locale: Locale;
}

export function CityPills({ cities, locale }: CityPillsProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const updateScrollState = () => {
    const el = trackRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    updateScrollState();
    const el = trackRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateScrollState, { passive: true });
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateScrollState);
      ro.disconnect();
    };
  }, []);

  const scroll = (dir: "left" | "right") => {
    const el = trackRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "right" ? 200 : -200, behavior: "smooth" });
  };

  const displayCities = cities.slice(0, 8);

  return (
    <div className="relative mx-auto mt-2 w-full max-w-6xl sm:mt-4">
      <button
        onClick={() => scroll("left")}
        className={`absolute left-2 top-1/2 z-20 -translate-y-1/2 flex size-9 items-center justify-center rounded-full border border-slate-900/[0.06] bg-slate-900/[0.05] text-slate-900 shadow-emboss-alpha transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-900/[0.08] active:scale-[0.97] active:bg-slate-900/[0.12] active:shadow-emboss-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100 ${
          canScrollLeft ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-label="Chapga"
      >
        <ChevronLeft className="size-5" />
      </button>

      {/* Pills track */}
      <div
        ref={trackRef}
        className="flex items-center gap-2 overflow-x-auto px-12 py-2 scrollbar-none sm:justify-center"
      >
        {displayCities.map((city) => (
          <Link
            key={city.id}
            href={`/${locale}/hotels?city_id=${encodeURIComponent(city.id)}`}
            className="inline-flex h-9 sm:h-10 shrink-0 items-center justify-center rounded-full border border-slate-900/[0.06] bg-slate-900/[0.05] px-5 text-sm sm:text-[15px] font-medium text-slate-900 shadow-emboss-alpha transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-900/[0.08] active:scale-[0.97] active:bg-slate-900/[0.12] active:shadow-emboss-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <span className="capitalize">{city.name}</span>
          </Link>
        ))}
      </div>

      <button
        onClick={() => scroll("right")}
        className={`absolute right-2 top-1/2 z-20 -translate-y-1/2 flex size-9 items-center justify-center rounded-full border border-slate-900/[0.06] bg-slate-900/[0.05] text-slate-900 shadow-emboss-alpha transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-900/[0.08] active:scale-[0.97] active:bg-slate-900/[0.12] active:shadow-emboss-pressed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100 ${
          canScrollRight ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-label="O'ngga"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
