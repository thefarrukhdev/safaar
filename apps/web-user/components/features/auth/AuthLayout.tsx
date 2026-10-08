"use client";

import React, { ReactNode, useState, useEffect } from "react";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { Locale } from "@/i18n/config";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { AuthDict } from "@/i18n/dictionaries";

interface AuthLayoutProps {
  children: ReactNode;
  locale: Locale;
  dict?: AuthDict;
}

const IMAGES = [
  { src: "/images/heroes/samarqans.jpg", alt: "Samarkand Registan" },
  { src: "/images/heroes/hotels_hero.jpg", alt: "Luxury Hotel" },
  { src: "/images/mock/Zaamin.jpeg", alt: "Zaamin Mountains" },
];

export function AuthLayout({ children, locale, dict }: AuthLayoutProps) {
  const [currentImage, setCurrentImage] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentImage((prev) => (prev + 1) % IMAGES.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row items-stretch justify-center overflow-hidden relative selection:bg-blue-500/30">
      {/* Top Controls */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        <Link 
          href={`/${locale}`}
          className="flex items-center gap-2 px-4 h-10 bg-white border border-slate-200 hover:bg-slate-50 active:bg-slate-100 rounded-full text-slate-700 text-sm font-semibold transition-all duration-300 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Ortga</span>
        </Link>
        <LocaleSwitcher current={locale} />
      </div>

      {/* LEFT COLUMN: THE DESTINATION CAROUSEL */}
      <div className="hidden lg:flex relative w-1/2 flex-shrink-0 z-20 items-end justify-start p-12 overflow-hidden bg-slate-900">
        
        {IMAGES.map((image, index) => (
          <div
            key={index}
            className={`absolute inset-0 z-0 transition-all duration-[1500ms] ease-in-out ${
              index === currentImage ? "opacity-100 scale-100" : "opacity-0 scale-105 pointer-events-none"
            }`}
          >
            <Image
              src={image.src}
              alt={image.alt}
              fill
              className="object-cover"
              priority={index === 0}
            />
            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </div>
        ))}

        <div className="relative z-10 text-white max-w-lg transition-all duration-700">
          <div className="mb-4 w-full h-20 flex justify-start items-center">
            <h1 className="text-6xl md:text-[80px] font-black tracking-tighter uppercase !m-0 drop-shadow-lg text-transparent bg-clip-text bg-gradient-to-br from-white to-white/70">
              Safaar
            </h1>
          </div>
          <p className="text-lg font-medium text-slate-200">
            {dict?.bannerSubtitle || "O'zbekiston bo'ylab eng yaxshi mehmonxonalar, dalahovlilar va oromgohlarni kashf eting."}
          </p>
          
          <div className="flex gap-2 mt-8">
            {IMAGES.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentImage ? 'w-8 bg-white' : 'w-4 bg-white/30'}`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: DYNAMIC CONTENT (WHITE CARD) */}
      <div className="w-full lg:w-1/2 flex items-center justify-center z-30 p-4 lg:p-12">
        <div className="w-full max-w-[420px] bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
}
