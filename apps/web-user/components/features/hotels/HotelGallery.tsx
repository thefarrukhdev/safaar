'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import { Camera, ImageIcon } from 'lucide-react';
import { Lightbox } from '@/components/ui/Lightbox';

export function HotelGallery({
  images,
  alt,
}: {
  images: string[];
  alt: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  const shots = images.filter(
    (src) => src.startsWith('http') || src.startsWith('/'),
  );

  if (shots.length === 0) {
    return (
      <div
        className="flex aspect-[21/9] w-full items-center justify-center rounded-2xl bg-slate-100 text-slate-900/40"
        role="img"
        aria-label={alt}
      >
        <ImageIcon className="h-12 w-12" />
      </div>
    );
  }

  return (
    <>
      {/* Desktop/Mobile Gallery Grid */}
      <div className="relative">
        <div
          className="group relative cursor-pointer overflow-hidden rounded-2xl"
          onClick={() => setIsOpen(true)}
        >
          <div className="grid grid-cols-1 gap-1.5 sm:h-[400px] sm:grid-cols-4 sm:grid-rows-2">
            {shots.slice(0, 5).map((src, index) => {
              const total = Math.min(shots.length, 5);
              let gridClasses = '';
              if (total === 1) gridClasses = 'sm:col-span-4 sm:row-span-2';
              else if (total === 2) {
                gridClasses = 'sm:col-span-2 sm:row-span-2';
              }
              else if (total === 3) {
                if (index === 0) gridClasses = 'sm:col-span-2 sm:row-span-2';
                else gridClasses = 'sm:col-span-2 sm:row-span-1';
              }
              else if (total === 4) {
                if (index === 0) gridClasses = 'sm:col-span-2 sm:row-span-2';
                else if (index === 1 || index === 2) gridClasses = 'sm:col-span-1 sm:row-span-1';
                else gridClasses = 'sm:col-span-2 sm:row-span-1';
              }
              else {
                if (index === 0) gridClasses = 'sm:col-span-2 sm:row-span-2';
                else gridClasses = 'sm:col-span-1 sm:row-span-1';
              }
              
              const isLastVisible = index === total - 1;
              const isMain = index === 0;

              return (
                <div
                  key={`${src}-${index}`}
                  className={cn(
                    'relative overflow-hidden bg-slate-100',
                    !isMain && 'hidden sm:block',
                    isMain ? 'aspect-[16/10] sm:aspect-auto w-full' : '',
                    gridClasses
                  )}
                >
                  <Image
                    src={src}
                    alt={`${alt} — ${isMain ? "Asosiy ko'rinish" : index + 1}`}
                    priority={isMain}
                    fill
                    sizes={isMain ? "(max-width: 640px) 100vw, 50vw" : "25vw"}
                    className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] group-hover:scale-[1.02] motion-reduce:transition-none"
                    quality={isMain ? 85 : 75}
                  />
                  {(isLastVisible || (isMain && shots.length > 1)) && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsOpen(true);
                      }}
                      className={cn(
                        "absolute bottom-4 right-4 z-10 h-10 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 text-sm font-medium text-slate-900 transition-all duration-200 ease-out hover:bg-slate-50 active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 motion-reduce:transition-none motion-reduce:active:scale-100",
                        isMain && !isLastVisible ? "flex sm:hidden" : "",
                        isLastVisible && !isMain ? "hidden sm:flex" : "flex"
                      )}
                    >
                      <Camera className="size-5" aria-hidden="true" />
                      <span>{shots.length} ta rasm</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fullscreen Lightbox */}
      <Lightbox
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        images={shots}
        alt={alt}
      />
    </>
  );
}
