"use client";

import { useEffect, useState, useCallback } from"react";
import { X, ChevronLeft, ChevronRight } from"lucide-react";
import { createPortal } from"react-dom";
import Image from"next/image";

interface LightboxProps {
 isOpen: boolean;
 onClose: () => void;
 images: string[];
 alt?: string;
 initialIndex?: number;
}

export function Lightbox({
 isOpen,
 onClose,
 images,
 alt ="Image",
 initialIndex = 0,
}: LightboxProps) {
 const [mounted, setMounted] = useState(false);
 const [currentIndex, setCurrentIndex] = useState(initialIndex);

 useEffect(() => {
 const t = setTimeout(() => setMounted(true), 0);
 return () => clearTimeout(t);
 }, []);

 useEffect(() => {
 if (isOpen) {
 document.body.style.overflow ="hidden";
 const t = setTimeout(() => setCurrentIndex(initialIndex), 0);
 return () => {
 document.body.style.overflow ="unset";
 clearTimeout(t);
 }
 } else {
 document.body.style.overflow ="unset";
 }
 return () => {
 document.body.style.overflow ="unset";
 };
 }, [isOpen, initialIndex]);

 const showNext = useCallback(() => {
 if (currentIndex < images.length - 1) {
 setCurrentIndex((prev) => prev + 1);
 }
 }, [currentIndex, images.length]);

 const showPrev = useCallback(() => {
 if (currentIndex > 0) {
 setCurrentIndex((prev) => prev - 1);
 }
 }, [currentIndex]);

 useEffect(() => {
 const handleKeyDown = (e: KeyboardEvent) => {
 if (!isOpen) return;
 if (e.key ==="Escape") onClose();
 if (e.key ==="ArrowRight") showNext();
 if (e.key ==="ArrowLeft") showPrev();
 };
 window.addEventListener("keydown", handleKeyDown);
 return () => window.removeEventListener("keydown", handleKeyDown);
 }, [isOpen, showNext, showPrev, onClose]);

 if (!mounted || !isOpen || images.length === 0) return null;

 return createPortal(
 <div className="fixed inset-0 z-[200] flex flex-col bg-black animate-in fade-in duration-200">
 {/* Header Bar */}
 <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/60 to-transparent">
 <div className="text-white font-medium px-2">
 {currentIndex + 1} / {images.length}
 </div>
 <button
 onClick={onClose}
 className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none"
 aria-label="Yopish"
 >
 <X className="size-6"/>
 </button>
 </div>

 {/* Main Image Area */}
 <div className="relative flex flex-1 items-center justify-center overflow-hidden">
 <Image
 src={images[currentIndex]}
 alt={`${alt} ${currentIndex + 1}`}
 fill
 className="object-contain"
 sizes="100vw"
 priority
 />
 </div>

 {/* Navigation Controls */}
 {images.length > 1 && (
 <>
 <button
 onClick={(e) => {
 e.stopPropagation();
 showPrev();
 }}
 disabled={currentIndex === 0}
 className="absolute left-2 sm:left-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-3 text-white/50 transition-all hover:bg-white/10 hover:text-white disabled:opacity-0 focus-visible:outline-none"
 aria-label="Oldingi"
 >
 <ChevronLeft className="size-8 sm:size-10"/>
 </button>
 <button
 onClick={(e) => {
 e.stopPropagation();
 showNext();
 }}
 disabled={currentIndex === images.length - 1}
 className="absolute right-2 sm:right-4 top-1/2 z-10 -translate-y-1/2 rounded-full p-3 text-white/50 transition-all hover:bg-white/10 hover:text-white disabled:opacity-0 focus-visible:outline-none"
 aria-label="Keyingi"
 >
 <ChevronRight className="size-8 sm:size-10"/>
 </button>
 </>
 )}
 </div>,
 document.body
 );
}
