"use client";

import React, { ReactNode, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { Locale } from "@/i18n/config";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import MaskedHeading from "@/components/reactbits/MaskedHeading";
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
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row items-stretch justify-center overflow-hidden relative selection:bg-primary-500/30">
      
      {/* Top Controls */}
      <div className="absolute top-6 right-6 z-50 flex items-center gap-3">
        <Link 
          href={`/${locale}`}
          className="flex items-center gap-2 px-4 h-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full text-slate-700 dark:text-slate-200 text-sm font-semibold transition-all duration-300 shadow-sm"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="hidden sm:inline">Ortga</span>
        </Link>
        <LocaleSwitcher current={locale} />
      </div>

      {/* LEFT COLUMN: THE DESTINATION CAROUSEL */}
      <div className="hidden lg:flex relative w-1/2 flex-shrink-0 z-20 items-end justify-start p-12 overflow-hidden bg-slate-900">
        <AnimatePresence initial={false}>
          <motion.div
            key={currentImage}
            initial={{ opacity: 0, scale: 1.05 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
            className="absolute inset-0 z-0"
          >
            <Image
              src={IMAGES[currentImage].src}
              alt={IMAGES[currentImage].alt}
              fill
              className="object-cover"
              priority
            />
            {/* Dark gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          </motion.div>
        </AnimatePresence>

        <div className="relative z-10 text-white max-w-lg">
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mb-4 w-full h-20 flex justify-start items-center"
          >
            <MaskedHeading 
              text="Safaar" 
              tag="h1"
              src={IMAGES[currentImage].src}
              fillScale={1.3}
              parallax={20}
              reveal="fade"
              textScale={0.16}
              align="left"
              className="text-6xl md:text-[80px] font-black tracking-tighter uppercase !m-0 drop-shadow-lg"
            />
          </motion.div>
          <motion.p 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="text-lg font-medium text-slate-200"
          >
            {dict?.bannerSubtitle || "O'zbekiston bo'ylab eng yaxshi mehmonxonalar, dalahovlilar va oromgohlarni kashf eting."}
          </motion.p>
          
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
