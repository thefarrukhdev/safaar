"use client";

import Link from "next/link";
import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { DestinationView } from "@safaar/api-client";
import type { Locale } from "@/i18n/config";

interface CityPillsProps {
  destinations: DestinationView[];
  locale: Locale;
}

export function CityPills({ destinations, locale }: CityPillsProps) {
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

  return (
    <div className="relative mx-auto mt-3 w-full max-w-6xl sm:mt-5">
      <button
        onClick={() => scroll("left")}
        className={`absolute left-0 sm:left-2 top-1/2 z-20 -translate-y-1/2 flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100 ${
          canScrollLeft ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-label="Chapga"
      >
        <ChevronLeft className="size-5" />
      </button>

      {/* Pills track */}
      <div
        ref={trackRef}
        className="flex items-center gap-2 overflow-x-auto px-6 sm:px-12 py-2 scrollbar-none sm:justify-center"
      >
        {destinations.map((dest) => (
          <Link
            key={dest.id}
            href={dest.link || `/${locale}/hotels?city_id=${encodeURIComponent(dest.slug)}`}
            className="inline-flex h-9 sm:h-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white px-5 text-sm sm:text-[15px] font-semibold text-slate-800 transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-50 hover:text-blue-700 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            <span className="capitalize">{dest.name}</span>
          </Link>
        ))}
      </div>

      <button
        onClick={() => scroll("right")}
        className={`absolute right-0 sm:right-2 top-1/2 z-20 -translate-y-1/2 flex size-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-900 transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-50 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100 ${
          canScrollRight ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        aria-label="O'ngga"
      >
        <ChevronRight className="size-5" />
      </button>
    </div>
  );
}
