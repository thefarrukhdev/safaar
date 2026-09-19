'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/cn';
import { Camera, ImageIcon } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Carousel } from '@/components/ui/Carousel';

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
        className="flex aspect-[21/9] w-full items-center justify-center rounded-xl bg-slate-900/[0.05] text-slate-900/40"
        role="img"
        aria-label={alt}
      >
        <ImageIcon className="h-12 w-12" />
      </div>
    );
  }

  const mainPhoto = shots[0];
  const sidePhotos = shots.slice(1, 5);

  return (
    <>
      {/* Desktop/Mobile Gallery Grid */}
      <div className="relative">
        <img
          src={mainPhoto}
          alt=""
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 size-full scale-110 rounded-xl object-cover opacity-30 blur-3xl saturate-150"
        />
        <div
          className="group relative cursor-pointer overflow-hidden rounded-xl"
          onClick={() => setIsOpen(true)}
        >
          <div className="grid grid-cols-1 gap-1.5 sm:h-[400px] sm:grid-cols-4 sm:grid-rows-2">
            {/* Large Main Featured Photo */}
            <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-900/[0.05] sm:col-span-2 sm:row-span-2 sm:aspect-auto">
              <Image
                src={mainPhoto}
                alt={`${alt} — Asosiy ko'rinish`}
                priority
                fill
                sizes="(max-width: 640px) 100vw, 50vw"
                className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] group-hover:scale-[1.02] motion-reduce:transition-none"
                quality={85}
              />
            </div>

            {/* 4 Smaller Grid Side Photos */}
            {sidePhotos.map((src, i) => (
              <div
                key={`${src}-${i}`}
                className={cn(
                  'relative hidden overflow-hidden bg-slate-900/[0.05] sm:block',
                  i === 0 && 'sm:col-span-1 sm:row-span-1',
                  i === 1 && 'sm:col-span-1 sm:row-span-1',
                  i === 2 && 'sm:col-span-1 sm:row-span-1',
                  i === 3 && 'sm:col-span-1 sm:row-span-1',
                )}
              >
                <Image
                  src={src}
                  alt={`${alt} — ${i + 2}`}
                  fill
                  sizes="25vw"
                  className="object-cover transition-transform duration-300 ease-[cubic-bezier(0.2,0,0,1)] group-hover:scale-[1.02] motion-reduce:transition-none"
                />
              </div>
            ))}
          </div>

          {/* Floating Photo Count Button */}
          {shots.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(true);
              }}
              className="absolute bottom-4 right-4 z-10 inline-flex h-10 items-center justify-center gap-2 rounded-full border border-slate-900/[0.06] bg-slate-900/[0.05] px-5 text-sm font-medium text-slate-900  transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-slate-900/[0.08] active:scale-[0.97] active:bg-slate-900/[0.12]  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              <Camera className="size-5" aria-hidden="true" />
              <span>{shots.length} ta rasm</span>
            </button>
          )}
        </div>
      </div>

      {/* Fullscreen Gallery Modal */}
      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        maxWidth="max-w-5xl"
        title="Barcha rasmlar"
      >
        <div className="mt-2 w-full px-1">
          <Carousel
            images={shots}
            alt={alt}
            aspectRatio="aspect-[16/10] sm:aspect-[21/9]"
            className="rounded-xl shadow-lg ring-1 ring-slate-200"
          />
        </div>
      </Modal>
    </>
  );
}
