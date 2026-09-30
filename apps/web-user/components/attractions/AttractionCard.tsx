"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageOff, MapPin, Heart, Star, Clock } from "lucide-react";
import { gsap } from "gsap";
import type { AttractionItem } from "@/components/catalog/types";

interface AttractionCardProps {
  item: AttractionItem;
  categoryLabel: string;
  index: number;
  onHover?: (hovering: boolean) => void;
}

const CATEGORY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  historical: {
    bg: "bg-amber-50 border-amber-200",
    text: "text-amber-800",
    dot: "bg-amber-500",
  },
  unesco: {
    bg: "bg-primary-50 border-primary-200",
    text: "text-primary-800",
    dot: "bg-primary-500",
  },
  nature: {
    bg: "bg-emerald-50 border-emerald-200",
    text: "text-emerald-800",
    dot: "bg-emerald-500",
  },
};

function FavoriteButton({ inset = false }: { inset?: boolean }) {
  const [active, setActive] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActive((v) => !v);
    if (btnRef.current) {
      gsap.fromTo(btnRef.current, { scale: 0.75 }, { scale: 1, duration: 0.35, ease: "back.out(3)" });
    }
  };

  return (
    <button
      ref={btnRef}
      type="button"
      aria-label="Sevimlilar"
      onClick={handleClick}
      className={`flex h-8 w-8 items-center justify-center rounded-full transition-all duration-200 hover:scale-110 ${
        active
          ? "bg-white/100 shadow-md"
          : "bg-white/80 shadow-sm hover:bg-white"
      } ${inset ? "absolute right-3 top-3 z-10" : ""}`}
    >
      <Heart
        className={`h-4 w-4 transition-colors duration-200 ${
          active ? "fill-rose-500 text-rose-500" : "text-slate-600"
        }`}
      />
    </button>
  );
}

export function AttractionCard({ item, categoryLabel, index, onHover }: AttractionCardProps) {
  const cardRef = useRef<HTMLElement>(null);
  const catStyle = CATEGORY_STYLES[item.categoryKey] ?? CATEGORY_STYLES.historical;

  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 20 },
      {
        opacity: 1,
        y: 0,
        duration: 0.5,
        delay: index * 0.05,
        ease: "power3.out",
        clearProps: "transform,opacity",
      },
    );
  }, [index]);

  return (
    <article
      ref={cardRef}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className="group flex cursor-pointer flex-col gap-3"
    >
      {/* ── Image Container ─────────────────────────────────────── */}
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl bg-slate-100 ">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.name}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            quality={85}
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-slate-100 ">
            <ImageOff className="h-8 w-8 text-slate-300 " />
          </div>
        )}

        <FavoriteButton inset />

        <div className="absolute left-3 top-3 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-bold text-slate-900 shadow-sm backdrop-blur-md  ">
            <span className={`h-1.5 w-1.5 rounded-full ${catStyle.dot}`} />
            {categoryLabel}
          </span>
        </div>
      </div>

      {/* ── Text Info ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 px-0.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-[15px] font-bold leading-tight text-slate-900 ">
            {item.name}
          </h3>
          {item.rating > 0 && (
            <div className="flex shrink-0 items-center gap-1 text-sm">
              <Star className="h-3.5 w-3.5 fill-slate-900 text-slate-900  " />
              <span className="font-medium text-slate-900 ">
                {item.rating.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-sm text-slate-500 ">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">{item.cityName}</span>
        </div>

        {item.bestTimeToVisit && (
          <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-slate-500 ">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{item.bestTimeToVisit}</span>
          </p>
        )}
      </div>
    </article>
  );
}
