"use client";

import { useEffect, useRef } from "react";

/**
 * Global Interactive Spotlight + Dot Matrix Background for Safaar
 *
 * Senior Architecture & Performance:
 * 1. 24px x 24px subtle dot-matrix base (ultra-clean, 0 visual noise for hotel cards).
 * 2. Dynamic illuminated blue dots layer masked around cursor position.
 * 3. 60-120fps GPU-accelerated cursor spotlight via requestAnimationFrame & CSS variables (0 React re-renders on move).
 * 4. Ambient top glow for mobile / resting state.
 * 5. Fixed viewport positioning (-z-10) with pointer-events-none and aria-hidden="true" (0 scroll repaints).
 * 6. Full support for prefers-reduced-motion and touch devices.
 */
export function GlobalSpotlightBackground() {
  const containerRef = useRef<HTMLDivElement>(null);
  const rafId = useRef<number | null>(null);
  const latestCoords = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    // Touch device detection (mobile uses serene ambient glow instead of cursor tracking)
    const isTouch =
      typeof window !== "undefined" &&
      (window.matchMedia("(hover: none)").matches || "ontouchstart" in window);

    if (isTouch) {
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const updatePosition = () => {
      if (!latestCoords.current || !container) return;
      const { x, y } = latestCoords.current;
      container.style.setProperty("--mouse-x", `${x}px`);
      container.style.setProperty("--mouse-y", `${y}px`);
      rafId.current = null;
    };

    const handlePointerMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      latestCoords.current = { x: e.clientX, y: e.clientY };

      if (rafId.current === null) {
        rafId.current = requestAnimationFrame(updatePosition);
      }
    };

    const handlePointerLeave = () => {
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      latestCoords.current = null;
      if (container) {
        container.style.setProperty("--spotlight-opacity", "0");
      }
    };

    const handlePointerEnter = () => {
      if (container) {
        container.style.setProperty("--spotlight-opacity", "1");
      }
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("pointerleave", handlePointerLeave, { passive: true });
    window.addEventListener("pointerenter", handlePointerEnter, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerleave", handlePointerLeave);
      window.removeEventListener("pointerenter", handlePointerEnter);
      if (rafId.current !== null) {
        cancelAnimationFrame(rafId.current);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
      style={
        {
          "--mouse-x": "50%",
          "--mouse-y": "25%",
          "--spotlight-opacity": "1",
        } as React.CSSProperties
      }
    >
      {/* 1. Base Subtle Dot Matrix Grid (24px x 24px) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `radial-gradient(circle, rgba(148, 163, 184, 0.45) 1.1px, transparent 1.1px)`,
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0",
        }}
      />

      {/* 2. Active Illuminated Blue Dots Layer (masked around cursor) */}
      <div
        className="absolute inset-0 transition-opacity duration-300 motion-reduce:hidden"
        style={{
          opacity: "var(--spotlight-opacity, 1)",
          backgroundImage: `radial-gradient(circle, rgba(37, 99, 235, 0.8) 1.3px, transparent 1.3px)`,
          backgroundSize: "24px 24px",
          backgroundPosition: "0 0",
          WebkitMaskImage: `radial-gradient(
            380px circle at var(--mouse-x, 50%) var(--mouse-y, 25%),
            black 15%,
            transparent 75%
          )`,
          maskImage: `radial-gradient(
            380px circle at var(--mouse-x, 50%) var(--mouse-y, 25%),
            black 15%,
            transparent 75%
          )`,
        }}
      />

      {/* 3. Interactive Cursor Spotlight Radial Glow */}
      <div
        className="absolute inset-0 transition-opacity duration-200 ease-out motion-reduce:hidden"
        style={{
          opacity: "var(--spotlight-opacity, 1)",
          background: `radial-gradient(
            640px circle at var(--mouse-x, 50%) var(--mouse-y, 25%),
            rgba(37, 99, 235, 0.12),
            rgba(99, 102, 241, 0.04) 45%,
            transparent 70%
          )`,
        }}
      />

      {/* 4. Ambient Top Center Header Glow (serene, tranquil depth) */}
      <div
        className="absolute inset-x-0 top-0 h-[600px]"
        style={{
          background: `radial-gradient(
            900px circle at 50% -100px,
            rgba(59, 130, 246, 0.09),
            rgba(147, 197, 253, 0.03) 50%,
            transparent 80%
          )`,
        }}
      />
    </div>
  );
}

export default GlobalSpotlightBackground;
