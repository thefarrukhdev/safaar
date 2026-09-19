"use client";

import { useEffect } from "react";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight } from "lucide-react";

export function PhotoLightbox({
  photos,
  currentIndex,
  onClose,
  onNavigate,
}: {
  photos: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && currentIndex > 0) onNavigate(currentIndex - 1);
      if (e.key === "ArrowRight" && currentIndex < photos.length - 1)
        onNavigate(currentIndex + 1);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, photos.length, onClose, onNavigate]);

  if (!photos || photos.length === 0 || currentIndex < 0) return null;

  const currentPhoto = photos[currentIndex];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-md animate-in fade-in duration-200">
      <button
        type="button"
        onClick={onClose}
        className="absolute right-6 top-6 rounded-full bg-white/10 p-2.5 text-white transition-colors hover:bg-white/20"
        aria-label="Yopish"
      >
        <X className="h-6 w-6" />
      </button>

      {/* Navigation Left */}
      {currentIndex > 0 && (
        <button
          type="button"
          onClick={() => onNavigate(currentIndex - 1)}
          className="absolute left-6 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
          aria-label="Oldingi rasm"
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
      )}

      {/* Navigation Right */}
      {currentIndex < photos.length - 1 && (
        <button
          type="button"
          onClick={() => onNavigate(currentIndex + 1)}
          className="absolute right-6 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition-colors hover:bg-white/20"
          aria-label="Keyingi rasm"
        >
          <ChevronRight className="h-6 w-6" />
        </button>
      )}

      {/* Image container */}
      <div className="relative max-h-[85vh] max-w-[90vw] aspect-4/3 overflow-hidden rounded-xl">
        <Image
          src={currentPhoto}
          alt={`Photo ${currentIndex + 1}`}
          fill
          className="object-contain"
        />
      </div>

      {/* Counter indicator */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-bold text-white backdrop-blur-md">
        {currentIndex + 1} / {photos.length}
      </div>
    </div>
  );
}
