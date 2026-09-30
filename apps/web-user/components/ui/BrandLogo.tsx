import Link from "next/link";
import { cn } from "@/lib/cn";

interface BrandLogoProps {
  href: string;
  brand: string;
  className?: string;
  variant?: "dark" | "light";
}

export function BrandLogo({ href, brand, className, variant = "light" }: BrandLogoProps) {
  const isDark = variant === "dark";

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center rounded-xl py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-opacity hover:opacity-90",
        className
      )}
    >
      <span className={cn(
        "font-black tracking-tighter text-2xl sm:text-3xl md:text-[34px] leading-none",
        isDark ? "text-white" : "text-primary-600 "
      )}>
        {brand}
      </span>
    </Link>
  );
}
