"use client";

import { CSSProperties, ReactNode } from"react";

interface PromoShinyTextProps {
 children: ReactNode;
 speed?: number;
 className?: string;
}

/**
 * Oq va sariq rangli shiny text effekti —
 * to'q ko'k (primary) fon ustida ishlash uchun mo'ljallangan.
 */
export function PromoShinyText({
 children,
 speed = 3,
 className ="",
}: PromoShinyTextProps) {
 return (
 <span
 className={`inline-block bg-clip-text text-transparent bg-[length:200%_100%]
 bg-[linear-gradient(110deg,#ffffff,40%,#FFB600,50%,#ffffff,60%,#ffffff)]
 animate-[shine_var(--speed)_linear_infinite]
 ${className}`}
 style={{"--speed": `${speed}s` } as CSSProperties}
 >
 {children}
 </span>
 );
}
