import { cn } from "@/lib/cn";

export type Variant = "primary" | "accent" | "secondary" | "ghost";
export type Size = "sm" | "md" | "lg";
export type Rounded = "full";

export const variantClasses: Record<Variant, string> = {
  primary:
    "border border-blue-700/50 bg-blue-600 text-white shadow-emboss-primary hover:bg-blue-700 active:shadow-emboss-pressed",
  accent:
    "border border-amber-600/50 bg-amber-500 text-slate-900 shadow-emboss-accent hover:bg-amber-600 active:shadow-emboss-pressed",
  secondary:
    "border border-slate-900/[0.06] bg-slate-900/[0.05] text-slate-900 shadow-emboss-alpha hover:bg-slate-900/[0.08] active:bg-slate-900/[0.12] active:shadow-emboss-pressed",
  ghost:
    "border border-transparent bg-transparent text-slate-900 shadow-none hover:bg-slate-900/[0.05] active:bg-slate-900/[0.08]",
};

export const sizeClasses: Record<Size, string> = {
  sm: "h-8 px-4 text-sm",
  md: "h-10 max-md:h-11 px-5 text-sm",
  lg: "h-12 px-6 text-base",
};

export const roundedClasses: Record<Rounded, string> = {
  full: "rounded-full",
};

export const baseButtonClasses =
  "inline-flex items-center justify-center gap-2 font-medium " +
  "transition-[background-color,box-shadow,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] " +
  "active:scale-[0.97] " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 " +
  "disabled:pointer-events-none disabled:opacity-40 disabled:shadow-none " +
  "motion-reduce:transition-none motion-reduce:active:scale-100";

export function buttonVariants({
  variant = "primary",
  size = "md",
  rounded = "full",
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
