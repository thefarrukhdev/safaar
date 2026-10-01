import Link from "next/link";
import Image from "next/image";
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
      title={brand}
    >
      <div className="relative flex items-center transition-all duration-300">
        <Image 
          src="/logo.png" 
          alt={brand} 
          width={180} 
          height={60} 
          className="object-contain w-auto h-8 sm:h-10"
        />
      </div>
    </Link>
  );
}
