"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageOff, MapPin, Heart, Star, Clock } from "lucide-react";
import { gsap } from "gsap";
import Link from "next/link";
import type { AttractionItem } from "@/components/catalog/types";

interface AttractionCardProps {
  item: AttractionItem;
  categoryLabel: string;
  index: number;
  locale: string;
  onHover?: (hovering: boolean) => void;
}

const CATEGORY_STYLES: Record<string, { dot: string }> = {
  historical: {
    dot: "bg-slate-500",
  },
  unesco: {
    dot: "bg-blue-600",
  },
  nature: {
    dot: "bg-slate-500",
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
      className={`flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white transition-all duration-200 hover:scale-110 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
        !active && "hover:bg-slate-50"
      } ${inset ? "absolute right-3 top-3 z-10" : ""}`}
    >
      <Heart
        className={`h-4 w-4 transition-colors duration-200 ${
          active ? "fill-blue-600 text-blue-600" : "text-slate-900"
        }`}
      />
    </button>
  );
}

export function AttractionCard({ item, categoryLabel, index, locale, onHover }: AttractionCardProps) {
  const cardRef = useRef<HTMLAnchorElement>(null);
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
    <Link
      href={`/${locale}/attractions/${item.id}`}
      ref={cardRef}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className="group overflow-hidden rounded-2xl border border-slate-200 bg-white transition-colors duration-200 ease-out hover:border-slate-300 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-white block"
    >
      {/* ── Image Container ─────────────────────────────────────── */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-slate-100">
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
          <div className="flex h-full items-center justify-center bg-slate-100">
            <ImageOff className="h-8 w-8 text-slate-300" />
          </div>
        )}

        <FavoriteButton inset />

        <div className="absolute left-3 top-3 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-900">
            <span className={`h-1.5 w-1.5 rounded-full ${catStyle.dot}`} />
            {categoryLabel}
          </span>
        </div>
      </div>

      {/* ── Text Info ─────────────────────────────────────────── */}
      <div className="flex flex-col gap-1 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-lg font-semibold leading-tight text-slate-900">
            {item.name}
          </h3>
          {item.rating > 0 && (
            <div className="flex shrink-0 items-center gap-1 text-sm mt-0.5">
              <Star className="h-3.5 w-3.5 fill-slate-900 text-slate-900" />
              <span className="font-medium text-slate-900">
                {item.rating.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="line-clamp-1">{item.cityName}</span>
        </div>

        {item.bestTimeToVisit && (
          <p className="mt-0.5 flex items-center gap-1.5 text-sm text-slate-500">
            <Clock className="h-3.5 w-3.5 shrink-0" />
            <span className="line-clamp-1">{item.bestTimeToVisit}</span>
          </p>
        )}
      </div>
    </Link>
  );
}
