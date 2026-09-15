"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import type { HeaderProps } from "./types";
import { HeaderBrand } from "./HeaderBrand";
import { DesktopNavLinks } from "./DesktopNavLinks";
import { MobileNav } from "./MobileNav";

export function HeaderWrapper(props: HeaderProps) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 w-full transition-all duration-300",
        scrolled
          ? "bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-200 dark:bg-slate-950/95 dark:border-slate-800"
          : "bg-transparent border-transparent"
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
