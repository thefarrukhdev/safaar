'use client';

import { Camera, Star } from 'lucide-react';
import { cn } from '../../../_lib/utils/cn';

interface LivePreviewProps {
  cover?: string;
  name: string;
  city: string;
  stars: number;
  showStars: boolean;
  shortDescription: string;
  photosCount: number;
  onOpen: () => void;
}

export function LivePreview({
  cover,
  name,
  city,
  stars,
  showStars,
  shortDescription,
  photosCount,
  onOpen,
}: LivePreviewProps) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative min-h-[260px] overflow-hidden bg-zinc-900 text-left text-white lg:min-h-full"
    >
      {cover ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={cover}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-brand-950">
          <Camera className="h-12 w-12 text-white/30" aria-hidden />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
      <div className="relative flex h-full min-h-[260px] flex-col justify-end p-4">
        <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-md bg-black/45 px-2 py-1 text-xs font-medium backdrop-blur">
          <Camera className="h-3.5 w-3.5" aria-hidden />
          {photosCount} ta rasm
        </span>
        <h2 className="text-xl font-semibold">{name || 'Nomi kiritilmagan'}</h2>
        <div className="mt-1 flex items-center gap-1 text-sm text-white/85">
          {showStars &&
            Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={cn(
                  'h-3.5 w-3.5',
                  index < stars
                    ? 'fill-amber-400 stroke-amber-400'
                    : 'stroke-white/45',
                )}
                aria-hidden
              />
            ))}
          <span className={showStars ? 'ml-1' : ''}>{city}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/80">
          {shortDescription || 'Qisqa tavsif hali kiritilmagan.'}
        </p>
      </div>
    </button>
  );
}
