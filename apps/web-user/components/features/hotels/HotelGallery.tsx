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
        className="flex aspect-[21/9] w-full items-center justify-center rounded-xl bg-slate-100 text-slate-400"
        role="img"
        aria-label={alt}
      >
        <ImageIcon className="h-12 w-12 opacity-50" />
      </div>
    );
  }

  const mainPhoto = shots[0];
  const sidePhotos = shots.slice(1, 5);

  return (
    <>
      {/* Desktop/Mobile Gallery Grid */}
      <div
        className="group relative cursor-pointer overflow-hidden rounded-xl border border-slate-200 shadow-sm transition-all hover:shadow-md"
        onClick={() => setIsOpen(true)}
      >
        <div className="grid grid-cols-1 gap-1.5 sm:h-[400px] sm:grid-cols-4 sm:grid-rows-2">
          {/* Large Main Featured Photo */}
          <div className="relative aspect-[16/10] w-full overflow-hidden bg-slate-100 sm:col-span-2 sm:row-span-2 sm:aspect-auto">
            <Image
              src={mainPhoto}
              alt={`${alt} — Asosiy ko'rinish`}
              priority
              fill
              sizes="(max-width: 640px) 100vw, 50vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              quality={85}
            />
          </div>

          {/* 4 Smaller Grid Side Photos */}
          {sidePhotos.map((src, i) => (
            <div
              key={`${src}-${i}`}
              className={cn(
                'relative hidden overflow-hidden bg-slate-100 sm:block',
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
                className="object-cover transition-transform duration-300 hover:scale-105"
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
            className="absolute bottom-4 right-4 z-10 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 shadow-sm transition-all hover:scale-105 hover:bg-slate-50 active:scale-95"
          >
            <Camera className="h-4 w-4 text-slate-800" />
            <span>{shots.length} ta rasm</span>
          </button>
        )}
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
