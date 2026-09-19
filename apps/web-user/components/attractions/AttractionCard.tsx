"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ImageOff, MapPin, Heart, Star, Clock, Sparkles } from "lucide-react";
import { gsap } from "gsap";
import { useDesignStore } from "@/lib/store/design-store";
import type { AttractionItem } from "@/components/catalog/types";

interface AttractionCardProps {
  item: AttractionItem;
  categoryLabel: string;
  index: number;
}

// ─── CATEGORY BADGE COLORS (Silk Road Palette) ───────────────────────────────
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

// ─── SHARED FAVORITE BUTTON ───────────────────────────────────────────────────
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
      className={`flex h-8 w-8 items-center justify-center rounded-full border border-white/80 bg-white/90 shadow-md backdrop-blur-md transition-all duration-200 hover:scale-110 hover:bg-white dark:border-slate-700 dark:bg-slate-900/90 ${inset ? "absolute right-3 top-3 z-10" : ""}`}
    >
      <Heart
        className={`h-4 w-4 transition-colors duration-200 ${active ? "fill-rose-500 text-rose-500" : "text-slate-500 dark:text-slate-300"}`}
      />
    </button>
  );
}

// ─── STAR RATING (Ark Amber from Design System) ───────────────────────────────
function StarRating({ rating }: { rating: number }) {
  if (!rating) return null;
  return (
    <div className="flex items-center gap-1">
      <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" aria-hidden />
      <span className="text-xs font-bold tabular-nums text-amber-700 dark:text-amber-400">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export function AttractionCard({ item, categoryLabel, index }: AttractionCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const imgMainRef = useRef<HTMLDivElement>(null);
  const imgARef = useRef<HTMLDivElement>(null);
  const imgBRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const catStyle = CATEGORY_STYLES[item.categoryKey] ?? CATEGORY_STYLES.historical;

  // ── Stagger entrance animation
  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(
      cardRef.current,
      { opacity: 0, y: 28, filter: "blur(4px)" },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        duration: 0.55,
        delay: index * 0.07,
        ease: "power3.out",
        clearProps: "filter,transform,opacity",
      },
    );
  }, [index]);

  // ── Hover: Card lift + image scale (all three grid images)
  const handleMouseEnter = () => {
    gsap.to(cardRef.current, { y: -6, duration: 0.3, ease: "power2.out" });
    gsap.to([imgMainRef.current, imgARef.current, imgBRef.current], {
      scale: 1.07,
      duration: 0.4,
      ease: "power2.out",
    });
  };
  const handleMouseLeave = () => {
    gsap.to(cardRef.current, { y: 0, duration: 0.3, ease: "power2.inOut" });
    gsap.to([imgMainRef.current, imgARef.current, imgBRef.current], {
      scale: 1,
      duration: 0.35,
      ease: "power2.inOut",
    });
  };

  // ── Jade Push Button interaction
  const handleBtnEnter = () =>
    gsap.to(btnRef.current, { y: -1, duration: 0.15, ease: "power2.out" });
  const handleBtnLeave = () =>
    gsap.to(btnRef.current, { y: 0, duration: 0.15, ease: "power2.in" });
  const handleBtnDown = () =>
    gsap.to(btnRef.current, { y: 2, duration: 0.1, ease: "power2.in" });
  const handleBtnUp = () =>
    gsap.to(btnRef.current, { y: 0, duration: 0.2, ease: "back.out(2)" });

  return (
    <article
      ref={cardRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="group flex flex-col overflow-hidden rounded-xl bg-white
        shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_4px_12px_rgba(0,0,0,0.07),0_1px_3px_rgba(0,0,0,0.04)]
        ring-1 ring-slate-200/80 transition-shadow duration-300
        dark:bg-slate-900 dark:ring-slate-700/60
        dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_4px_16px_rgba(0,0,0,0.35)]"
    >
      {/* ── Bento Grid Gallery ─────────────────────────────────── */}
      <div className="relative grid h-52 grid-cols-3 gap-1.5 overflow-hidden rounded-t-3xl bg-slate-100/80 p-1.5 dark:bg-slate-800/80 sm:h-56">
        {/* Main image — left 2/3 */}
        <div
          ref={imgMainRef}
          className="relative col-span-2 overflow-hidden rounded-xl bg-slate-200 dark:bg-slate-700"
        >
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.name}
              fill
              sizes="(max-width: 640px) 66vw, 33vw"
              className="object-cover"
              quality={85}
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-emerald-50">
              <ImageOff className="h-8 w-8 text-emerald-300" />
            </div>
          )}
        </div>

        {/* Small images — right col, stacked */}
        <div className="col-span-1 flex flex-col gap-1.5">
          <div ref={imgARef} className="relative flex-1 overflow-hidden rounded-xl bg-amber-50 dark:bg-slate-700">
            {item.imageUrl && (
              <Image src={item.imageUrl} alt="" fill sizes="20vw" unoptimized className="object-cover brightness-[0.88] saturate-[1.1]" quality={70} />
            )}
          </div>
          <div ref={imgBRef} className="relative flex-1 overflow-hidden rounded-xl bg-sky-50 dark:bg-slate-700">
            {item.imageUrl && (
              <Image src={item.imageUrl} alt="" fill sizes="20vw" unoptimized className="object-cover brightness-75 saturate-[1.15]" quality={65} />
            )}
          </div>
        </div>

        {/* Favorite */}
        <FavoriteButton inset />

        {/* Category badge — Silk Road Palette (on image) */}
        <div className="absolute bottom-3 left-3 z-10">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-bold text-white backdrop-blur-md">
            <span className={`h-1.5 w-1.5 rounded-full ${catStyle.dot}`} />
            {categoryLabel}
          </span>
        </div>

        {/* Rating pill — Ark Amber from design system */}
        {item.rating > 0 && (
          <div className="absolute right-3 bottom-3 z-10">
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2 py-1 text-[10px] font-black text-amber-950 shadow-sm">
              <Star className="h-2.5 w-2.5 fill-amber-900 text-amber-900" />
              {item.rating.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* ── Card Body ─────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-3">
        <h3 className="line-clamp-1 text-[15px] font-black tracking-tight text-slate-900 dark:text-white">
          {item.name}
        </h3>

        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 dark:text-slate-500">
          <MapPin className="h-3 w-3 shrink-0 text-primary-500" />
          <span>{item.cityName}</span>
        </div>

        {item.bestTimeToVisit && (
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
            <Clock className="h-3 w-3 shrink-0 text-amber-400" />
            <span className="line-clamp-1">{item.bestTimeToVisit}</span>
          </p>
        )}

        {/* ── Jade Push Button (Design System Signature) ─────── */}
        <div className="mt-auto pt-2">
          <button
            ref={btnRef}
            type="button"
            onMouseEnter={handleBtnEnter}
            onMouseLeave={handleBtnLeave}
            onMouseDown={handleBtnDown}
            onMouseUp={handleBtnUp}
            className="w-full rounded-xl bg-primary-600 py-2.5 text-xs font-bold tracking-wide text-white
              shadow-sm
              transition-shadow duration-150
              hover:bg-primary-500
              hover:shadow-md
              active:shadow-none"
          >
            Batafsil
          </button>
        </div>
      </div>
    </article>
  );
}
