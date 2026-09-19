"use client";

import { useRef, useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface CityCardItem {
  image: string;
  label: string;
  link: string;
  alt: string;
}

interface CityCardsMobileCarouselProps {
  items: CityCardItem[];
}

export function CityCardsMobileCarousel({ items }: CityCardsMobileCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  // Touch swipe support
  const touchStart = useRef(0);
  const touchEnd = useRef(0);

  const goTo = (index: number) => {
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    setActiveIndex(clamped);
    trackRef.current?.children[clamped]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  };

  // Intersection observer to track active card on scroll
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const idx = Array.from(track.children).indexOf(entry.target as HTMLElement);
            if (idx !== -1) setActiveIndex(idx);
          }
        });
      },
      { root: track, threshold: 0.6 }
    );
    Array.from(track.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [items]);

  return (
    <div className="relative w-full">
      {/* Swipeable track */}
      <div
        ref={trackRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory scrollbar-none pb-2"
        onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
        onTouchEnd={(e) => {
          touchEnd.current = e.changedTouches[0].clientX;
          const diff = touchStart.current - touchEnd.current;
          if (Math.abs(diff) > 40) goTo(diff > 0 ? activeIndex + 1 : activeIndex - 1);
        }}
      >
        {items.map((item, i) => (
          <Link
            key={i}
            href={item.link}
            className="group relative flex-none w-[72vw] max-w-[280px] snap-center rounded-xl overflow-hidden shadow-card border border-slate-900/[0.08] aspect-[3/4] block"
          >
            <Image
              src={item.image}
              alt={item.alt}
              fill
              sizes="280px"
              className="object-cover duration-300 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none group-hover:scale-[1.02]"
              priority={i === 0}
            />
            {/* Gradient overlay */}
            <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            {/* Label */}
            <span className="absolute bottom-4 left-4 right-4 z-10">
              <span className="block text-white font-bold text-base leading-tight drop-shadow-md">
                {item.label.split(" • ")[0]}
              </span>
              <span className="block text-white/80 text-xs mt-0.5 font-medium">
                {item.label.split(" • ")[1]}
              </span>
            </span>
          </Link>
        ))}
      </div>

      {/* Navigation arrows */}
      <div className="flex items-center justify-between mt-3 px-1">
        {/* Dots */}
        <div className="flex gap-1.5">
          {items.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === activeIndex
                  ? "w-5 h-2 bg-primary-500"
                  : "w-2 h-2 bg-slate-300 dark:bg-slate-600"
              }`}
              aria-label={`${i + 1}-shaharni ko'rish`}
            />
          ))}
        </div>

        {/* Arrow buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => goTo(activeIndex - 1)}
            disabled={activeIndex === 0}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-emboss-alpha text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300"
            aria-label="Oldingi"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => goTo(activeIndex + 1)}
            disabled={activeIndex === items.length - 1}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-emboss-alpha text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all hover:bg-slate-50 dark:bg-slate-800 dark:text-slate-300"
            aria-label="Keyingi"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
