"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { HeaderProps } from "./types";
import { HeaderBrand } from "./HeaderBrand";
import { DesktopNavLinks } from "./DesktopNavLinks";
import { MobileNav } from "./MobileNav";

export function HeaderWrapper(props: HeaderProps) {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [hidden, setHidden] = useState(false);
  const lastScroll = useRef(0);

  // Check if we are on the homepage (e.g., /uz, /ru, /en, or /)
  const isHome = pathname === "/" || /^\/[a-z]{2}$/.test(pathname);
  const isTransparent = isHome && !scrolled;

  useEffect(() => {
    const handleScroll = () => {
      const currentScroll = window.scrollY;
      setScrolled(currentScroll > 20);
      
      if (currentScroll > 200 && currentScroll > lastScroll.current) {
        setHidden(true);
      } else {
        setHidden(false);
      }
      lastScroll.current = currentScroll;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      data-transparent={isTransparent}
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300 group/header",
        isTransparent
          ? "bg-transparent border-transparent"
          : "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200 dark:bg-slate-950/95 dark:border-slate-800",
        hidden ? "-translate-y-full" : "translate-y-0"
      )}
    >
      <div className="mx-auto w-full max-w-[1536px] px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 md:h-16 items-center justify-between">
          
          {/* Mobile View */}
          <div className="flex w-full md:hidden flex-col justify-center">
             <MobileNav {...props} />
          </div>

          {/* Desktop View */}
          <div className="hidden md:flex w-full items-center justify-between">
            <HeaderBrand href={props.brandHref} brand={props.brand} />
            
            <div className="flex-1 flex justify-center">
              <DesktopNavLinks items={props.items} />
            </div>

            <div className="flex shrink-0 items-center gap-3">
              {props.actions}
            </div>
          </div>

        </div>
      </div>
    </header>
  );
}
