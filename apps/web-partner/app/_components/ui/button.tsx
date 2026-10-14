import { Slot } from "@radix-ui/react-slot";
import { Loader2 } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../_lib/utils/cn";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "outline"
  | "ghost"
  | "danger"
  | "subtle";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

// Moslik uchun type aliaslar
export type Variant = ButtonVariant;
export type Size = ButtonSize;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Yuklanmoqda holati — smooth spinner, layout shift bo'lmaydi va disabled qiladi. */
  loading?: boolean;
  /** Radix Slot orqali bolani (masalan, Next.js Link) polimorfik tugma qilish. */
  asChild?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: cn(
    "bg-gradient-to-b from-brand-500 to-brand-600 text-white font-medium",
    "border border-brand-600/90 hover:from-brand-400 hover:to-brand-500 active:from-brand-600 active:to-brand-700",
    "shadow-sm shadow-brand-900/15 hover:shadow-md hover:shadow-brand-900/25",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]",
    "dark:border-brand-400/30 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
    "disabled:from-brand-400 disabled:to-brand-400 disabled:border-transparent disabled:opacity-50 disabled:shadow-none",
  ),
  secondary: cn(
    "bg-white text-slate-800 font-medium",
    "border border-slate-200/90 hover:bg-slate-50 hover:border-slate-300 hover:text-slate-900 active:bg-slate-100",
    "shadow-xs shadow-slate-900/5",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]",
    "dark:bg-slate-800/90 dark:text-slate-100 dark:border-slate-700/80 dark:hover:bg-slate-800 dark:hover:border-slate-600 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
    "disabled:bg-slate-100 dark:disabled:bg-slate-800/40 disabled:border-slate-200/60 dark:disabled:border-slate-700/40 disabled:text-slate-400 dark:disabled:text-slate-500 disabled:shadow-none",
  ),
  outline: cn(
    "border border-[var(--border)] bg-transparent text-[var(--foreground)] font-medium",
    "hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] active:bg-[var(--surface-hover)]",
    "shadow-xs",
    "disabled:border-[var(--border)]/50 disabled:text-[var(--muted-foreground)]/60 disabled:shadow-none",
  ),
  ghost: cn(
    "border border-transparent bg-transparent text-[var(--foreground)] font-medium",
    "hover:bg-[var(--surface-muted)] hover:text-[var(--foreground)] active:bg-[var(--surface-hover)]",
    "disabled:text-[var(--muted-foreground)]/50",
  ),
  danger: cn(
    "bg-gradient-to-b from-rose-500 to-rose-600 text-white font-medium",
    "border border-rose-600/90 hover:from-rose-400 hover:to-rose-500 active:from-rose-600 active:to-rose-700",
    "shadow-sm shadow-rose-900/15 hover:shadow-md hover:shadow-rose-900/25",
    "shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]",
    "focus-visible:ring-rose-500",
    "dark:border-rose-400/30 dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.18)]",
    "disabled:from-rose-400 disabled:to-rose-400 disabled:border-transparent disabled:opacity-50 disabled:shadow-none",
  ),
  subtle: cn(
    "bg-[var(--surface-muted)] text-[var(--foreground)] font-medium",
    "border border-[var(--border)]/70 hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] active:bg-[var(--surface-muted)]",
    "shadow-2xs",
    "disabled:bg-[var(--surface-muted)]/50 disabled:border-[var(--border)]/30 disabled:text-[var(--muted-foreground)]/60 disabled:shadow-none",
  ),
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 min-h-[36px] px-3.5 text-xs gap-1.5 rounded-lg touch-manipulation before:absolute before:top-1/2 before:left-1/2 before:-translate-x-1/2 before:-translate-y-1/2 before:w-[max(100%,44px)] before:h-[max(100%,44px)] before:content-[''] before:pointer-events-auto sm:before:hidden",
  md: "h-11 min-h-[44px] px-4.5 text-sm gap-2 rounded-xl",
  lg: "h-12 min-h-[48px] px-6 text-base gap-2.5 rounded-xl",
  icon: "h-11 w-11 min-h-[44px] min-w-[44px] p-0 rounded-xl",
};

const spinnerSizes: Record<ButtonSize, string> = {
  sm: "h-3.5 w-3.5",
  md: "h-4 w-4",
  lg: "h-5 w-5",
  icon: "h-4 w-4",
};

export function buttonVariants({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}): string {
  return cn(
    "relative inline-flex items-center justify-center select-none whitespace-nowrap cursor-pointer",
    "transition-all duration-150 ease-out transform-gpu",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[var(--background)]",
    "disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:transform-none",
    "active:scale-[0.98]",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant = "primary",
    size = "md",
    type = "button",
    loading = false,
    disabled = false,
    asChild = false,
    children,
    ...props
  },
  ref,
) {
  const isDisabled = disabled || loading;
  const classes = buttonVariants({ variant, size, className });

  if (asChild) {
    return (
      <Slot
        ref={ref}
        aria-busy={loading || undefined}
        aria-disabled={isDisabled || undefined}
        className={classes}
        {...props}
      >
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      className={classes}
      {...props}
    >
      {loading && (
        <span
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <Loader2 className={cn("animate-spin shrink-0", spinnerSizes[size])} />
        </span>
      )}
      <span
        className={cn(
          "inline-flex items-center justify-center gap-[inherit] transition-opacity duration-150",
          loading && "opacity-0 select-none pointer-events-none",
        )}
      >
        {children}
      </span>
    </button>
  );
});
