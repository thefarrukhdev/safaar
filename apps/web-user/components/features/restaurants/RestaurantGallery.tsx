"use client";

import { useState } from "react";
import Image from "next/image";
import { Camera, UtensilsCrossed } from "lucide-react";
import { cn } from "@/lib/cn";
import { Lightbox } from "@/components/ui/Lightbox";

export function RestaurantGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [photoIndex, setPhotoIndex] = useState(0);

  const shots = images.filter(
    (src) => src && (src.startsWith("http") || src.startsWith("/"))
  );

  const openAt = (idx: number) => {
    setPhotoIndex(idx);
    setIsOpen(true);
  };

  if (shots.length === 0) {
    return (
      <div
        className="relative flex aspect-[21/9] w-full items-center justify-center overflow-hidden rounded-2xl border border-slate-200/80 bg-gradient-to-br from-amber-50 via-orange-50 to-emerald-50 text-slate-700 shadow-sm"
        role="img"
        aria-label={alt}
      >
        <div className="flex flex-col items-center gap-3 p-6 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md ring-1 ring-slate-900/5">
            <UtensilsCrossed className="h-8 w-8 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-slate-800 text-lg">{alt}</h3>
            <p className="text-xs text-slate-500 mt-0.5">Safaar maxsus restoranlar to'plami</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-sm">
        <div className="grid grid-cols-1 gap-1.5 sm:h-[380px] md:h-[440px] sm:grid-cols-4 sm:grid-rows-2">
          {shots.slice(0, 5).map((src, index) => {
            const total = Math.min(shots.length, 5);
            let gridClasses = "";
            if (total === 1) {
              gridClasses = "sm:col-span-4 sm:row-span-2";
            } else if (total === 2) {
              gridClasses = "sm:col-span-2 sm:row-span-2";
            } else if (total === 3) {
              if (index === 0) gridClasses = "sm:col-span-2 sm:row-span-2";
              else gridClasses = "sm:col-span-2 sm:row-span-1";
            } else if (total === 4) {
              if (index === 0) gridClasses = "sm:col-span-2 sm:row-span-2";
              else if (index === 1 || index === 2) gridClasses = "sm:col-span-1 sm:row-span-1";
              else gridClasses = "sm:col-span-2 sm:row-span-1";
            } else {
              if (index === 0) gridClasses = "sm:col-span-2 sm:row-span-2";
              else gridClasses = "sm:col-span-1 sm:row-span-1";
            }

            const isLastVisible = index === total - 1;
            const isMain = index === 0;

            return (
              <div
                key={`${src}-${index}`}
                onClick={() => openAt(index)}
                className={cn(
                  "group relative cursor-pointer overflow-hidden bg-slate-200 transition-all",
                  !isMain && "hidden sm:block",
                  isMain ? "aspect-[16/10] sm:aspect-auto w-full" : "",
                  gridClasses
                )}
              >
                <Image
                  src={src}
                  alt={`${alt} — ${isMain ? "Asosiy ko'rinish" : index + 1}`}
                  priority={isMain}
                  fill
                  sizes={isMain ? "(max-width: 640px) 100vw, 50vw" : "25vw"}
                  className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                  quality={isMain ? 85 : 75}
                />
                <div className="absolute inset-0 bg-black/0 transition-colors duration-200 group-hover:bg-black/15" />

                {(isLastVisible || (isMain && shots.length > 1)) && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openAt(index);
                    }}
                    className={cn(
                      "absolute bottom-3 right-3 z-10 inline-flex items-center gap-2 rounded-xl border border-white/40 bg-slate-900/80 px-3.5 py-1.5 text-xs font-semibold text-white shadow-lg backdrop-blur-md transition hover:bg-slate-900 active:scale-95",
                      isMain && !isLastVisible ? "flex sm:hidden" : "",
                      isLastVisible && !isMain ? "hidden sm:flex" : "flex"
                    )}
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>{shots.length} ta rasm</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Lightbox
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        images={shots}
        initialIndex={photoIndex}
        alt={alt}
      />
    </>
  );
}
