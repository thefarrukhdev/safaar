"use client";

import { useRef, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

interface CarouselProps {
  images: string[];
  alt?: string;
  className?: string;
  aspectRatio?: string;
}

export function Carousel({
  images,
  alt = "Image",
  className = "",
  aspectRatio = "aspect-[4/3]",
}: CarouselProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Scroll hodisasini eshitib, dot (nuqta) indikatorlarini yangilash
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollLeft = container.scrollLeft;
      const width = container.clientWidth;
      const newIndex = Math.round(scrollLeft / width);
      setCurrentIndex(newIndex);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToIndex = (index: number) => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    containerRef.current.scrollTo({
      left: width * index,
      behavior: "smooth",
    });
  };

  if (!images || images.length === 0) return null;

  return (
    <div className={`relative group overflow-hidden rounded-xl ${className}`}>
      {/* Scrollable Container */}
      <div
        ref={containerRef}
        className={`flex w-full snap-x snap-mandatory overflow-x-auto ${aspectRatio} [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]`}
      >
        {images.map((src, idx) => (
          <div key={idx} className="relative h-full w-full flex-none snap-center bg-slate-100 dark:bg-slate-800">
            <Image
              src={src}
              alt={`${alt} ${idx + 1}`}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
          </div>
        ))}
      </div>

      {/* Navigation Arrows (Faqatgina hover qilinganda chiqadi, xuddi Airbnb kabi) */}
      {images.length > 1 && (
        <>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (currentIndex > 0) scrollToIndex(currentIndex - 1);
            }}
            className={`absolute left-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur-sm transition-all hover:scale-110 hover:bg-white active:scale-95 ${
              currentIndex === 0
                ? "pointer-events-none opacity-0"
                : "opacity-0 group-hover:opacity-100"
            }`}
            aria-label="Oldingi rasm"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (currentIndex < images.length - 1) scrollToIndex(currentIndex + 1);
            }}
            className={`absolute right-3 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-900 shadow-md backdrop-blur-sm transition-all hover:scale-110 hover:bg-white active:scale-95 ${
              currentIndex === images.length - 1
                ? "pointer-events-none opacity-0"
                : "opacity-0 group-hover:opacity-100"
            }`}
            aria-label="Keyingi rasm"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          {/* Dots Indicator */}
          <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
            {images.map((_, idx) => (
              <button
                key={idx}
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  scrollToIndex(idx);
                }}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  currentIndex === idx
                    ? "w-4 bg-white shadow-sm"
                    : "w-1.5 bg-white/60 hover:bg-white/90"
                }`}
                aria-label={`${idx + 1}-rasmga o'tish`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
