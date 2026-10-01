import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

interface HeaderBrandProps {
  href: string;
  brand: string;
  className?: string;
}

export function HeaderBrand({ href, brand, className }: HeaderBrandProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex shrink-0 items-center focus-visible:outline-none",
        className
      )}
    >
      <div className="relative flex items-center transition-all duration-300 group-data-[transparent=true]/header:brightness-0 group-data-[transparent=true]/header:invert">
        <Image 
          src="/logo.png" 
          alt={brand} 
          width={240} 
          height={60} 
          className="object-contain w-auto h-8 sm:h-10"
          priority
        />
      </div>
    </Link>
  );
}
