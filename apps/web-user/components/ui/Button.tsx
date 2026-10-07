"use client";

import { ThinkingOrb } from "@/components/ui/thinking-orb";

import type { ButtonHTMLAttributes } from"react";

import { type Variant, type Size, type Rounded, buttonVariants } from"./button-variants";
import { cn } from"@/lib/cn";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
 variant?: Variant;
 size?: Size;
 rounded?: Rounded;
 /** Yuklanish holati: spinner ko'rsatadi, tugmani o'chiradi (aria-busy). */
 loading?: boolean;
}

export function Button({
 variant ="primary",
 size ="md",
 rounded ="full",
 loading = false,
 className,
 disabled,
 children,
 ...props
}: ButtonProps) {
 return (
 <button
 className={buttonVariants({ variant, size, rounded, className })}
 disabled={disabled || loading}
 aria-busy={loading || undefined}
 {...props}
 >
 {loading && (
 <ThinkingOrb size={16} state="base" />
 )}
 {children}
 </button>
 );
}
