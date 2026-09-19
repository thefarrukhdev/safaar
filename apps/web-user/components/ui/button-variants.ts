import { cn } from "@/lib/cn";

export type Variant = "primary" | "accent" | "secondary" | "ghost";
export type Size = "sm" | "md" | "lg";
export type Rounded = "full" | "2xl" | "xl" | "lg" | "md" | "sm";

export const variantClasses: Record<Variant, string> = {
  // ── Safaar Blue (Primary CTA) ─────────────────────────────
  primary:
    "bg-gradient-to-b from-primary-500 to-primary-600 text-white font-medium " +
    "border border-primary-700/80 " +
    "shadow-[inset_0_1px_1px_rgba(255,255,255,0.3),0_2px_4px_rgba(0,0,0,0.1)] " +
    "hover:from-primary-600 hover:to-primary-700 " +
    "active:scale-[0.97] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] active:from-primary-700 active:to-primary-700 " +
    "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] " +
    "disabled:bg-none disabled:bg-slate-200 disabled:text-slate-400 disabled:border-transparent disabled:shadow-none disabled:active:scale-100",

  // ── Safaar Amber (Secondary CTA — Premium, Deals) ─────────────────────────────
  accent:
    "bg-gradient-to-b from-accent-400 to-accent-500 text-white font-medium " +
    "border border-accent-600/80 " +
    "shadow-[inset_0_1px_1px_rgba(255,255,255,0.35),0_2px_4px_rgba(0,0,0,0.1)] " +
    "hover:from-accent-500 hover:to-accent-600 " +
    "active:scale-[0.97] active:shadow-[inset_0_2px_4px_rgba(0,0,0,0.2)] active:from-accent-600 active:to-accent-600 " +
    "transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] " +
    "disabled:bg-none disabled:bg-slate-200 disabled:text-slate-400 disabled:border-transparent disabled:shadow-none disabled:active:scale-100",

  // ── Fluid Design System: Secondary (Alpha Overlay with Brand Tint) ────────────────────────────────────
  secondary:
    "bg-primary-900/[0.03] text-primary-900 border border-primary-900/[0.08] " +
    "hover:bg-primary-900/[0.06] hover:border-primary-900/[0.16] " +
    "active:bg-primary-900/[0.12] active:scale-[0.97] " +
    "dark:bg-primary-50/[0.08] dark:text-primary-50 dark:border-primary-50/[0.08] " +
    "dark:hover:bg-primary-50/[0.15] dark:hover:border-primary-50/[0.16] " +
    "dark:active:bg-primary-50/[0.20] " +
    "font-medium transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] " +
    "disabled:opacity-50 disabled:active:scale-100",

  // ── Fluid Design Ghost (No border, just surface alpha) ────────────────────────────────────
  ghost:
    "bg-transparent text-primary-900 " +
    "hover:bg-primary-900/[0.06] active:bg-primary-900/[0.12] active:scale-[0.97] " +
    "dark:text-primary-50 dark:hover:bg-primary-50/[0.10] dark:active:bg-primary-50/[0.15] " +
    "font-medium transition-all duration-200 ease-[cubic-bezier(0.2,0,0,1)] " +
    "disabled:opacity-50 disabled:active:scale-100",
};

export const sizeClasses: Record<Size, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-10 px-4 text-sm",
  lg: "h-11 px-5 text-base",
};

export const roundedClasses: Record<Rounded, string> = {
  full: "rounded-full",
  "2xl": "rounded-2xl",
  xl: "rounded-xl",
  lg: "rounded-lg",
  md: "rounded-md",
  sm: "rounded-sm",
};

export const baseButtonClasses = 
  "inline-flex items-center justify-center gap-2 transition-all focus-visible:outline-none disabled:pointer-events-none";

export function buttonVariants({
  variant = "primary",
  size = "md",
  rounded = "lg",
  className,
}: {
  variant?: Variant;
  size?: Size;
  rounded?: Rounded;
  className?: string;
} = {}) {
  return cn(
    baseButtonClasses,
    variantClasses[variant],
    sizeClasses[size],
    roundedClasses[rounded],
    className,
  );
}
