"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ImageOff, Heart, MapPin, ChevronRight, ChevronLeft } from "lucide-react";
import { formatSum } from "@/lib/utils/money";

export interface UniversalCardProps {
  imageSrc?: string | string[] | null;
  imageAlt?: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  variant?: "default" | "overlay";

  // Top Media Slots
  topLeft?: React.ReactNode;
  topRight?: React.ReactNode;
  showFavorite?: boolean;
  isFavorite?: boolean;
  onFavoriteToggle?: (isFav: boolean) => void;

  // Content
  title: React.ReactNode;
  location?: React.ReactNode;
  tags?: Array<string | { label: string; icon?: React.ReactNode }> | React.ReactNode;
  extraInfo?: React.ReactNode;

  // Price & Action Footer
  price?: {
    amount: number | string;
    oldAmount?: number | string;
    period?: string;
  };
  footerLeft?: React.ReactNode;
  footerRight?: React.ReactNode;
  actionLabel?: string;
  actionIcon?: React.ReactNode;
  onActionClick?: () => void;
}

export function UniversalCard({
  imageSrc,
  imageAlt = "",
  href,
  onClick,
  className = "",
  variant = "default",
  topLeft,
  topRight,
  showFavorite = false,
  isFavorite: initialIsFavorite = false,
  onFavoriteToggle,
  title,
  location,
  tags,
  extraInfo,
  price,
  footerLeft,
  footerRight,
  actionLabel,
  actionIcon,
  onActionClick,
}: UniversalCardProps) {
  const [favorite, setFavorite] = useState(initialIsFavorite);

  // Carousel State
  const [currentImageIdx, setCurrentImageIdx] = useState(0);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const [touchStartTime, setTouchStartTime] = useState<number | null>(null);

  const images = Array.isArray(imageSrc) ? imageSrc : (imageSrc ? [imageSrc] : []);

  const handleFavoriteClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextState = !favorite;
    setFavorite(nextState);
    onFavoriteToggle?.(nextState);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
    setTouchStartTime(Date.now());
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd || !touchStartTime) return;
    const distance = touchStart - touchEnd;
    const time = Date.now() - touchStartTime;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (time <= 300) {
      if (isLeftSwipe && currentImageIdx < images.length - 1) {
        setCurrentImageIdx((prev) => prev + 1);
      } else if (isRightSwipe && currentImageIdx > 0) {
        setCurrentImageIdx((prev) => prev - 1);
      }
    }
  };

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentImageIdx < images.length - 1) setCurrentImageIdx((p) => p + 1);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (currentImageIdx > 0) setCurrentImageIdx((p) => p - 1);
  };

  const renderImages = () => {
    if (images.length === 0) {
      return (
        <div className="flex h-full w-full flex-col items-center justify-center text-slate-400 opacity-60">
          <ImageOff className={variant === "overlay" ? "mb-2 h-8 w-8" : "mb-2 h-10 w-10"} />
          {variant === "overlay" && <span className="text-xs font-medium uppercase tracking-wider">Rasm yo'q</span>}
        </div>
      );
    }

    return (
      <div 
        className="relative w-full h-full overflow-hidden"
        onTouchStart={images.length > 1 ? handleTouchStart : undefined}
        onTouchMove={images.length > 1 ? handleTouchMove : undefined}
        onTouchEnd={images.length > 1 ? handleTouchEnd : undefined}
      >
        <div 
          className="flex w-full h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${currentImageIdx * 100}%)` }}
        >
          {images.map((src, idx) => (
            <div key={idx} className="relative min-w-full h-full">
              <Image
                src={src}
                alt={imageAlt}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] group-hover/card:scale-[1.02] motion-reduce:transition-none motion-reduce:group-hover/card:scale-100"
                quality={85}
                loading={idx <= currentImageIdx + 1 ? "eager" : "lazy"}
              />
            </div>
          ))}
        </div>
        
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={prevImage}
              className={`absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 shadow-md flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity z-20 cursor-pointer disabled:hidden ${currentImageIdx === 0 ? 'hidden' : ''}`}
            >
              <ChevronLeft className="h-4 w-4 text-slate-700" />
            </button>
            <button
              type="button"
              onClick={nextImage}
              className={`absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-white/90 shadow-md flex items-center justify-center opacity-0 group-hover/card:opacity-100 transition-opacity z-20 cursor-pointer disabled:hidden ${currentImageIdx === images.length - 1 ? 'hidden' : ''}`}
            >
              <ChevronRight className="h-4 w-4 text-slate-700" />
            </button>
            
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1 z-20">
              {images.slice(0, 5).map((_, idx) => {
                const isActive = currentImageIdx >= 4 ? idx === 4 : idx === currentImageIdx;
                return (
                  <div 
                    key={idx} 
                    className={`h-1.5 rounded-full transition-colors ${isActive ? 'w-1.5 bg-white' : 'w-1.5 bg-white/50'}`}
                  />
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  // Resolve Location Node
  const locationNode = location ? (
    typeof location === "string" ? (
      <span className="inline-flex items-center gap-1 text-[11px] sm:text-xs font-medium text-slate-900/70 truncate">
        <MapPin className="size-3.5 shrink-0 text-slate-900/70" />
        <span className="truncate">{location}</span>
      </span>
    ) : (
      location
    )
  ) : null;

  // Resolve Tags Node
  const tagsNode = Array.isArray(tags) ? (
    <div className="flex flex-wrap items-center gap-1 sm:gap-1.5 pt-0.5 overflow-hidden">
      {tags.map((tag, idx) => {
        const tagText = typeof tag === "string" ? tag : tag.label;
        const tagIcon = typeof tag === "string" ? null : tag.icon;
        return (
          <span
            key={`${tagText}-${idx}`}
            className="inline-flex h-5 items-center gap-1 rounded-full border border-slate-900/[0.06] bg-slate-900/[0.05] px-2 text-[10px] sm:text-[11px] font-semibold text-slate-900/70"
          >
            {tagIcon}
            <span>{tagText}</span>
          </span>
        );
      })}
    </div>
  ) : (
    tags
  );

  // Resolve Price Node
  const priceNode = price ? (
    <div className="flex flex-col leading-tight">
      {price.oldAmount !== undefined && (
        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400 line-through">
          {typeof price.oldAmount === "number" ? formatSum(price.oldAmount) : price.oldAmount}
        </span>
      )}
      <span className="text-sm sm:text-base md:text-lg font-semibold tracking-tight text-slate-900 dark:text-white">
        {typeof price.amount === "number" ? formatSum(price.amount) : price.amount}
      </span>
      {price.period && (
        <span className="text-[10px] sm:text-[11px] font-semibold text-slate-400">
          / {price.period}
        </span>
      )}
    </div>
  ) : null;

  // Resolve Action Node
  const actionNode = actionLabel ? (
    <span
      onClick={onActionClick ? (e) => { e.stopPropagation(); onActionClick(); } : undefined}
      className="inline-flex items-center gap-1 rounded-full bg-blue-600 px-3 py-1.5 text-[11px] sm:text-xs font-medium text-white  transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-blue-700 active:scale-[0.97]  select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100"
    >
      <span>{actionLabel}</span>
      {actionIcon ?? <ChevronRight className="h-3.5 w-3.5 stroke-[3]" />}
    </span>
  ) : null;

  const content = (
    <article
      className={`group/card flex h-full flex-col overflow-hidden rounded-xl border border-slate-900/[0.08] bg-white transition-[background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${className}`}
    >
      {variant === "overlay" ? (
        /* Overlay variant (e.g. City Card / Special Showcase) */
        <div className="relative aspect-[4/3] sm:aspect-[3/2] w-full overflow-hidden bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
          {renderImages()}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent" />
          {topLeft && <div className="absolute left-3 top-3 z-10">{topLeft}</div>}
          {(topRight || showFavorite) && (
            <div className="absolute right-3 top-3 z-10">
              {topRight ?? (
                <button
                  type="button"
                  aria-label="Sevimli"
                  aria-pressed={favorite}
                  onClick={handleFavoriteClick}
                  className="inline-flex size-8 items-center justify-center rounded-full bg-white/90 text-slate-900/70  backdrop-blur transition-[background-color,box-shadow,transform,color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-white hover:text-slate-900 active:scale-[0.97]  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <Heart
                    className={`size-4 transition-colors ${
                      favorite
                        ? "fill-rose-500 text-rose-500"
                        : "text-slate-900/70 hover:text-rose-500"
                    }`}
                  />
                </button>
              )}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 p-4">
            <div className="text-base sm:text-xl font-semibold text-white drop-shadow-md line-clamp-1">
              {title}
            </div>
            {locationNode && (
              <div className="mt-1 text-xs sm:text-sm font-medium text-white/90 drop-shadow-sm">
                {locationNode}
              </div>
            )}
            {extraInfo && (
              <div className="mt-1 text-xs font-medium text-white/80 drop-shadow-sm">
                {extraInfo}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Default variant (standard card) */
        <>
          {/* Top Media Section */}
          <div className="relative aspect-[4/3] sm:aspect-[16/10] w-full overflow-hidden rounded-t-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            {renderImages()}

            {topLeft && <div className="absolute left-3 top-3 z-10">{topLeft}</div>}

            {(topRight || showFavorite) && (
              <div className="absolute right-3 top-3 z-10">
                {topRight ?? (
                  <button
                  type="button"
                  aria-label="Sevimli"
                  aria-pressed={favorite}
                  onClick={handleFavoriteClick}
                  className="inline-flex size-8 items-center justify-center rounded-full bg-white/90 text-slate-900/70  backdrop-blur transition-[background-color,box-shadow,transform,color] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-white hover:text-slate-900 active:scale-[0.97]  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 cursor-pointer motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  <Heart
                    className={`size-4 transition-colors ${
                      favorite
                        ? "fill-rose-500 text-rose-500"
                        : "text-slate-900/70 hover:text-rose-500"
                    }`}
                  />
                </button>
                )}
              </div>
            )}
          </div>

          {/* Card Body */}
          <div className="flex flex-1 flex-col justify-between px-3.5 pt-3 pb-2 sm:px-4 sm:pt-3.5 sm:pb-2.5">
            <div className="flex flex-col gap-1">
              <div className="line-clamp-1 text-sm sm:text-base font-semibold text-slate-900 dark:text-white">
                {title}
              </div>
              {locationNode}
              {tagsNode}
              {extraInfo}
            </div>

            {/* Card Footer */}
            {(priceNode || footerLeft || actionNode || footerRight) && (
              <div className="mt-3 flex items-center justify-between gap-1.5 border-t border-slate-100 pt-2.5 sm:pt-3 dark:border-slate-800/80">
                <div className="flex flex-col min-w-0">{footerLeft ?? priceNode}</div>
                {(footerRight || actionNode) && (
                  <div className="shrink-0 flex items-center">
                    {footerRight ?? actionNode}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </article>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block h-full rounded-xl focus-visible:outline-none"
      >
        {content}
      </Link>
    );
  }

  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
      className={`group block h-full focus-visible:outline-none ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      {content}
    </div>
  );
}
