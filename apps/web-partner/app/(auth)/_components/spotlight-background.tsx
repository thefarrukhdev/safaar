"use client";

import {
  createContext,
  useContext,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { cn } from "../../_lib/utils/cn";

interface SpotlightContextType {
  registerCard: (el: HTMLDivElement | null) => void;
}

const SpotlightContext = createContext<SpotlightContextType | null>(null);

/**
 * Interactive Spotlight + Dot Matrix Background (Linear & Vercel style)
 *
 * Senior architecture:
 * 1. 24px x 24px subtle dot-matrix base.
 * 2. Active illuminated blue dots layer masked around cursor position.
 * 3. GPU-accelerated 60fps cursor spotlight via requestAnimationFrame & CSS variables (0 React re-renders on move).
 * 4. Ambient center glow for mobile / resting state.
 * 5. All decorative layers have pointer-events-none and aria-hidden="true".
 * 6. Respects prefers-reduced-motion.
 */
export function SpotlightBackground({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardElementRef = useRef<HTMLDivElement | null>(null);
  const rafId = useRef<number | null>(null);
  const latestCoords = useRef<{ clientX: number; clientY: number } | null>(null);

  const registerCard = (el: HTMLDivElement | null) => {
    cardElementRef.current = el;
  };

  useEffect(() => {
    const handleBlur = () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      latestCoords.current = null;
      if (containerRef.current) {
        containerRef.current.style.setProperty("--spotlight-opacity", "0");
      }
      if (cardElementRef.current) {
        cardElementRef.current.style.setProperty("--card-mouse-x", "-999px");
        cardElementRef.current.style.setProperty("--card-mouse-y", "-999px");
        cardElementRef.current.style.setProperty("--card-bloom-opacity", "0");
      }
    };

    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("blur", handleBlur);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  const handlePointerEnter = () => {
    if (containerRef.current) {
      containerRef.current.style.setProperty("--spotlight-opacity", "1");
    }
  };

  const handlePointerLeave = () => {
    if (rafId.current !== null) {
      cancelAnimationFrame(rafId.current);
      rafId.current = null;
    }
    latestCoords.current = null;
    if (containerRef.current) {
      containerRef.current.style.setProperty("--spotlight-opacity", "0");
    }
    if (cardElementRef.current) {
      cardElementRef.current.style.setProperty("--card-mouse-x", "-999px");
      cardElementRef.current.style.setProperty("--card-mouse-y", "-999px");
      cardElementRef.current.style.setProperty("--card-bloom-opacity", "0");
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    // Touch screen / mobile uses serene centered ambient glow
    if (e.pointerType === "touch") return;

    // Check prefers-reduced-motion
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    if (containerRef.current) {
      containerRef.current.style.setProperty("--spotlight-opacity", "1");
    }

    latestCoords.current = { clientX: e.clientX, clientY: e.clientY };

    if (rafId.current === null) {
      rafId.current = requestAnimationFrame(() => {
        rafId.current = null;
        if (!latestCoords.current) return;
        const { clientX, clientY } = latestCoords.current;

        // 1. Update background spotlight position
        if (containerRef.current) {
          const containerRect = containerRef.current.getBoundingClientRect();
          const bgX = clientX - containerRect.left;
          const bgY = clientY - containerRect.top;
          containerRef.current.style.setProperty("--mouse-x", `${bgX}px`);
          containerRef.current.style.setProperty("--mouse-y", `${bgY}px`);
        }

        // 2. Update card edge beam and proximity bloom
        if (cardElementRef.current) {
          const cardRect = cardElementRef.current.getBoundingClientRect();
          const cardX = clientX - cardRect.left;
          const cardY = clientY - cardRect.top;
          cardElementRef.current.style.setProperty("--card-mouse-x", `${cardX}px`);
          cardElementRef.current.style.setProperty("--card-mouse-y", `${cardY}px`);

          // Euclidean distance to nearest card edge
          const clampX = Math.max(0, Math.min(cardRect.width, cardX));
          const clampY = Math.max(0, Math.min(cardRect.height, cardY));
          const dist = Math.hypot(cardX - clampX, cardY - clampY);

          if (dist < 320) {
            const intensity = Math.max(0, 1 - dist / 320);
            cardElementRef.current.style.setProperty(
              "--card-bloom-opacity",
              intensity.toFixed(2)
            );
          } else {
            cardElementRef.current.style.setProperty("--card-bloom-opacity", "0");
          }
        }
      });
    }
  };

  return (
    <SpotlightContext.Provider value={{ registerCard }}>
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        className={cn(
          "relative min-h-screen w-full flex flex-col items-center justify-center overflow-x-hidden",
          "bg-slate-50 text-slate-900 dark:bg-[#0b0f17] dark:text-slate-100",
          "px-4 py-8 sm:py-12 selection:bg-blue-500/20",
          "[--spotlight-glow:rgba(37,99,235,0.14)] dark:[--spotlight-glow:rgba(59,130,246,0.18)]",
          "[--spotlight-opacity:1]",
          className
        )}
      >
        {/* Layer 1: Base Dot Matrix Background (24px x 24px) */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-0",
            "[background-size:24px_24px]",
            "[background-image:radial-gradient(rgba(148,163,184,0.35)_1px,transparent_1px)]",
            "dark:[background-image:radial-gradient(rgba(148,163,184,0.18)_1px,transparent_1px)]"
          )}
          style={{
            maskImage:
              "radial-gradient(ellipse 90% 80% at 50% 45%, #000 60%, transparent 100%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 90% 80% at 50% 45%, #000 60%, transparent 100%)",
          }}
        />

        {/* Layer 1b: Active Illuminated Blue Dots (Follows Cursor) */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-0 transition-opacity duration-300",
            "[background-size:24px_24px]",
            "[background-image:radial-gradient(rgba(37,99,235,0.75)_1.3px,transparent_1.3px)]",
            "dark:[background-image:radial-gradient(rgba(96,165,250,0.85)_1.3px,transparent_1.3px)]"
          )}
          style={{
            opacity: "var(--spotlight-opacity, 1)",
            maskImage:
              "radial-gradient(380px circle at var(--mouse-x, 50%) var(--mouse-y, 45%), black 15%, transparent 75%)",
            WebkitMaskImage:
              "radial-gradient(380px circle at var(--mouse-x, 50%) var(--mouse-y, 45%), black 15%, transparent 75%)",
          }}
        />

        {/* Layer 2: Calm Ambient Glow (Resting & Mobile) */}
        <div
          aria-hidden="true"
          className={cn(
            "pointer-events-none absolute inset-0 z-0",
            "bg-[radial-gradient(circle_520px_at_50%_42%,rgba(37,99,235,0.08),transparent_80%)]",
            "dark:bg-[radial-gradient(circle_520px_at_50%_42%,rgba(59,130,246,0.12),transparent_80%)]"
          )}
        />

        {/* Layer 3: Interactive Spotlight Radial (Cursor Tracker) */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 transition-opacity duration-200 ease-out"
          style={{
            opacity: "var(--spotlight-opacity, 1)",
            background: `radial-gradient(
              560px circle at var(--mouse-x, 50%) var(--mouse-y, 42%),
              var(--spotlight-glow, rgba(37, 99, 235, 0.14)),
              rgba(99, 102, 241, 0.04) 40%,
              transparent 72%
            )`,
          }}
        />

        {/* Foreground Content */}
        <div className="relative z-10 w-full flex flex-col items-center justify-center">
          {children}
        </div>
      </div>
    </SpotlightContext.Provider>
  );
}

/**
 * SpotlightCard with dynamic "Glow / Beam edge" effect and elevated depth.
 */
export function SpotlightCard({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const context = useContext(SpotlightContext);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (context && cardRef.current) {
      context.registerCard(cardRef.current);
    }
    return () => {
      if (context) {
        context.registerCard(null);
      }
    };
  }, [context]);

  return (
    <div
      ref={cardRef}
      className={cn(
        "group/card relative w-full rounded-2xl p-[1px] transition-shadow duration-300",
        "shadow-[0_20px_50px_-12px_rgba(15,23,42,0.08),0_1px_3px_0_rgba(15,23,42,0.04)] hover:shadow-xl",
        "[--card-beam:rgba(37,99,235,0.65)] dark:[--card-beam:rgba(96,165,250,0.75)]",
        "[--card-border:rgba(226,232,240,0.95)] dark:[--card-border:rgba(51,65,85,0.7)]",
        className
      )}
      style={{
        background: `radial-gradient(
          320px circle at var(--card-mouse-x, -999px) var(--card-mouse-y, -999px),
          var(--card-beam),
          var(--card-border) 60%
        )`,
      }}
    >
      {/* Outer Proximity Bloom along the illuminated edge */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-px rounded-2xl blur-xs transition-opacity duration-200"
        style={{
          opacity: "var(--card-bloom-opacity, 0)",
          background: `radial-gradient(
            260px circle at var(--card-mouse-x, -999px) var(--card-mouse-y, -999px),
            rgba(37, 99, 235, 0.22),
            transparent 70%
          )`,
        }}
      />

      {/* Card Content Surface */}
      <div className="relative rounded-[15px] bg-white dark:bg-slate-900 p-7 sm:p-9">
        {children}
      </div>
    </div>
  );
}
