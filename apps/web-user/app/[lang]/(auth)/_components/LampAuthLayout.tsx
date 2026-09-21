"use client";

import React, { useState, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import { Locale } from "@/i18n/config";

interface LampAuthLayoutProps {
  children: ReactNode;
  locale: Locale;
}

export function LampAuthLayout({ children, locale }: LampAuthLayoutProps) {
  const [isOn, setIsOn] = useState(true);

  const toggleLight = () => setIsOn(!isOn);

  return (
    <div className="min-h-screen bg-[#09090b] flex flex-col lg:flex-row items-center justify-center overflow-hidden relative selection:bg-blue-500/30">
      
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
              className="absolute top-[10%] lg:top-[20%] left-1/2 -translate-x-1/2 text-zinc-500 text-xs font-medium tracking-wide bg-zinc-900/50 px-3 py-1.5 rounded-full backdrop-blur-sm border border-zinc-800/50 shadow-lg pointer-events-none"
            >
              Yoritish uchun torting
            </motion.div>
          )}
        </AnimatePresence>

        <div className="relative flex flex-col items-center scale-75 lg:scale-100">
          {/* Lamp Shade */}
          <div className="relative z-10 w-48 h-32 bg-zinc-900 rounded-t-xl rounded-b-sm border border-zinc-800 shadow-2xl flex items-end justify-center overflow-hidden">
            <motion.div 
              animate={{ opacity: isOn ? 1 : 0.05 }}
              transition={{ duration: 0.2 }}
              className="absolute bottom-0 w-full h-12 bg-amber-500/20 blur-xl"
            />
          </div>

          {/* Bulb */}
          <motion.div
            animate={{
              backgroundColor: isOn ? "#fbbf24" : "#27272a",
              boxShadow: isOn 
                ? "0 0 40px 10px rgba(251,191,36,0.6), 0 0 100px 20px rgba(245,158,11,0.4)" 
                : "0 0 0px 0px rgba(251,191,36,0)",
            }}
            transition={{ duration: 0.1 }}
            className="w-12 h-6 rounded-b-full relative -mt-1 z-0"
          />

          {/* Stand */}
          <div className="w-3 h-64 lg:h-80 bg-zinc-900 border-x border-zinc-800 mt-0 z-[-1]" />
          <div className="w-24 h-4 bg-zinc-900 rounded-t-lg border border-zinc-800 z-[-1]" />

          {/* Pull String */}
          <motion.div
            drag="y"
            dragConstraints={{ top: 0, bottom: 40 }}
            dragElastic={0.2}
            onDragEnd={(e, info) => {
              if (info.offset.y > 20) toggleLight();
            }}
            onClick={toggleLight}
            className="absolute top-[140px] right-[40px] w-1 h-32 flex flex-col items-center cursor-grab active:cursor-grabbing group"
          >
            <div className="w-[2px] h-full bg-zinc-700 group-hover:bg-zinc-500 transition-colors" />
            <div className="w-4 h-6 bg-zinc-600 rounded-full border-2 border-zinc-500 shadow-lg group-hover:bg-zinc-400 transition-colors" />
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
