"use client";

import React, { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { Locale } from "@/i18n/config";
import Image from "next/image";

interface LampAuthLayoutProps {
  children: ReactNode;
  locale: Locale;
}

export function LampAuthLayout({ children, locale }: LampAuthLayoutProps) {
  const [isOn, setIsOn] = useState(true);

  const toggleLight = () => setIsOn(!isOn);

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col lg:flex-row items-center justify-center overflow-hidden relative selection:bg-blue-500/30">
      
      {/* VIBE: Dimmed Luxury Hotel Background */}
      <div className="absolute inset-0 z-0">
        <Image
          src="/experiment-hotel-picture.jpeg"
          alt="Luxury Hotel"
          fill
          className="object-cover transition-all duration-1000 mix-blend-luminosity"
          style={{ 
            opacity: isOn ? 0.15 : 0.08,
            filter: isOn ? "blur(2px) brightness(0.8)" : "blur(5px) brightness(0.3) contrast(1.2)" 
          }}
        />
        {/* Dark overlay with subtle blue tint for moonlight feeling in the dark */}
        <div className={`absolute inset-0 transition-colors duration-1000 ${isOn ? 'bg-gradient-to-r from-[#09090b] via-[#09090b]/80 to-[#09090b]' : 'bg-gradient-to-r from-[#020617] via-[#020617]/90 to-[#020617]'}`} />
      </div>
      
      {/* Top Controls */}
      <div className="absolute top-6 right-6 z-50">
        <LocaleSwitcher current={locale} light={true} />
      </div>

      {/* Background Ambient Glow when ON */}
      <AnimatePresence>
        {isOn && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            className="absolute inset-0 pointer-events-none"
            style={{
              background: "radial-gradient(circle at 30% 30%, rgba(245, 158, 11, 0.08) 0%, transparent 70%)"
            }}
          />
        )}
      </AnimatePresence>

      {/* LEFT COLUMN: THE LAMP */}
      <div className="relative w-full lg:w-1/2 h-[350px] lg:h-[600px] flex items-start lg:items-center justify-center flex-shrink-0 z-20 pt-16 lg:pt-0">
        
        <AnimatePresence>
          {!isOn && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-[10%] lg:top-[20%] left-1/2 -translate-x-1/2 text-zinc-300 text-xs font-bold tracking-widest bg-zinc-800/80 px-4 py-2 rounded-full backdrop-blur-md border border-zinc-600 shadow-[0_0_20px_rgba(255,255,255,0.15)] pointer-events-none animate-pulse"
            >
              Yoritish uchun torting
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex flex-col items-center scale-75 lg:scale-100 mt-12 lg:mt-0">
          {/* Lamp Shade (Realistic Metallic/Fabric) */}
          <div className="relative z-10 w-48 h-32 bg-gradient-to-b from-zinc-800 to-zinc-950 rounded-t-xl rounded-b-sm border-t border-x border-zinc-700/50 shadow-2xl flex items-end justify-center overflow-hidden">
            {/* Subtle top glare from moonlight */}
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-zinc-400/20 to-transparent" />
            <motion.div 
              animate={{ opacity: isOn ? 1 : 0.05 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-0 w-full h-12 bg-amber-500/20 blur-xl"
            />
          </div>

          {/* Bulb */}
          <motion.div
            animate={{
              backgroundColor: isOn ? "#fbbf24" : "#18181b", // darker when off
              boxShadow: isOn 
                ? "0 0 40px 10px rgba(251,191,36,0.6), 0 0 100px 20px rgba(245,158,11,0.4)" 
                : "0 0 0px 0px rgba(251,191,36,0)",
            }}
            transition={{ duration: 0.1 }}
            className="w-12 h-6 rounded-b-full relative -mt-1 z-0 shadow-inner"
          />

          {/* Stand (Metallic Cylinder) */}
          <div className="w-3 h-64 lg:h-80 bg-gradient-to-r from-zinc-950 via-zinc-700 to-zinc-950 border-x border-zinc-900 mt-0 z-[-1]" />
          <div className="w-24 h-4 bg-gradient-to-r from-zinc-800 via-zinc-700 to-zinc-900 rounded-t-lg border-t border-zinc-700 z-[-1]" />

          {/* Pull String (Metallic chain) */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 40 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (info.offset.y > 20) toggleLight();
            }}
            onClick={toggleLight}
            className="absolute top-[140px] right-[40px] w-1 h-32 flex flex-col items-center cursor-grab active:cursor-grabbing group z-50"
          >
            {/* The string itself */}
            <div className="w-[2px] h-full bg-gradient-to-b from-zinc-700 to-zinc-500 group-hover:from-zinc-500 group-hover:to-zinc-400 transition-all shadow-sm" />
            
            {/* The Pull Knob */}
            <div className="w-5 h-8 bg-gradient-to-b from-zinc-400 to-zinc-600 rounded-full border border-zinc-300 shadow-[0_4px_10px_rgba(0,0,0,0.5)] group-hover:from-zinc-300 group-hover:to-zinc-500 transition-all flex items-center justify-center">
               <div className="w-2 h-4 bg-zinc-200/20 rounded-full" /> {/* Inner reflection */}
            </div>
            
            {/* Subtle glow on hover/when off to guide the user */}
            <AnimatePresence>
              {!isOn && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute -bottom-4 w-12 h-12 bg-zinc-400/10 rounded-full blur-md animate-pulse"
                />
              )}
            </AnimatePresence>
          </motion.div>

          {/* Volumetric Cone */}
          <AnimatePresence>
            {isOn && (
              <motion.div
                initial={{ opacity: 0, scaleY: 0.8 }}
                animate={{ opacity: 1, scaleY: 1 }}
                exit={{ opacity: 0, scaleY: 0.8 }}
                transition={{ duration: 0.4, ease: "easeOut" }}
                className="absolute top-[140px] w-[600px] h-[600px] lg:h-[800px] origin-top pointer-events-none mix-blend-screen"
                style={{
                  background: "linear-gradient(to bottom, rgba(251,191,36,0.15) 0%, rgba(245,158,11,0.02) 60%, transparent 100%)",
                  clipPath: "polygon(40% 0, 60% 0, 100% 100%, 0% 100%)"
                }}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT COLUMN: DYNAMIC CONTENT (GLASS CARD) */}
      <div className="w-full lg:w-1/2 flex items-start lg:items-center justify-center z-30 p-4 lg:pr-12 pb-12 lg:pb-4">
        <motion.div
          animate={{
            opacity: isOn ? 1 : 0.4,
            filter: isOn ? "blur(0px)" : "blur(4px)",
            y: isOn ? 0 : 10,
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`w-full max-w-[420px] bg-zinc-900/80 backdrop-blur-xl border border-zinc-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden ${
            !isOn && "pointer-events-none select-none"
          }`}
        >
          {/* Subtle top glare */}
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-zinc-500/50 to-transparent" />
          
          {children}
          
        </motion.div>
      </div>
    </div>
  );
}
