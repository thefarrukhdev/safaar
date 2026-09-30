"use client";

import { CSSProperties, ReactNode } from "react";

interface ShinyTextProps {
  children: ReactNode;
  disabled?: boolean;
  speed?: number;
  className?: string;
}

export function ShinyText({
  children,
  disabled = false,
  speed = 3,
  className = "",
}: ShinyTextProps) {
  return (
    <span
      className={`inline-block bg-clip-text text-transparent bg-[length:200%_100%]
        bg-[linear-gradient(110deg,#0f172a,45%,#3b82f6,55%,#0f172a)]
        [linear-gradient(110deg,#ffffff,45%,#3b82f6,55%,#ffffff)]
        ${disabled ? "" : "animate-[shine_var(--speed)_linear_infinite]"} 
        ${className}`}
      style={
        {
          "--speed": `${speed}s`,
        } as CSSProperties
      }
    >
      {children}
    </span>
  );
}
