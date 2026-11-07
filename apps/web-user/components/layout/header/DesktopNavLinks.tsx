"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { motion } from "motion/react";
import { usePrefersReducedMotion } from "@/hooks/use-prefers-reduced-motion";
import { cn } from "@/lib/utils";
import type { NavItem } from "./types";

export function isActive(pathname: string, href: string, exact?: boolean) {
  if (exact) return pathname === href;
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function DesktopNavLinks({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const prefersReducedMotion = usePrefersReducedMotion();
  const [hoveredRect, setHoveredRect] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const handleMouseEnter = (el: HTMLElement) => {
    setHoveredRect({
      x: el.offsetLeft,
      y: el.offsetTop,
      width: el.offsetWidth,
      height: el.offsetHeight,
    });
  };

  const handleMouseLeave = () => {
    setHoveredRect(null);
  };

  return (
    <div
      onMouseLeave={handleMouseLeave}
      className="relative hidden md:flex items-center gap-1"
    >
      {/* Floating Fluid Highlight Pill on Hover */}
      {!prefersReducedMotion && hoveredRect && (
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={{
            x: hoveredRect.x,
            y: hoveredRect.y,
            width: hoveredRect.width,
            height: hoveredRect.height,
            opacity: 1,
          }}
          transition={{
            type: "spring",
            stiffness: 550,
            damping: 38,
            mass: 0.6,
          }}
          className="pointer-events-none absolute left-0 top-0 rounded-full bg-slate-100 group-data-[transparent=true]/header:bg-white/15"
        />
      )}

      {items.map((item) => {
        const active = isActive(pathname, item.href, item.exact);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onMouseEnter={(e) => handleMouseEnter(e.currentTarget)}
            className={cn(
              "relative z-10 flex items-center rounded-full px-3.5 py-2 text-[15px] font-bold transition-all duration-200 ease-out active:scale-[0.96] select-none",
              active
                ? "text-slate-900 bg-slate-100/80 group-data-[transparent=true]/header:text-white group-data-[transparent=true]/header:bg-white/20"
                : "text-slate-600 hover:text-slate-900 group-data-[transparent=true]/header:text-white"
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
