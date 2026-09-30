import Link from "next/link";
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
      <span className="text-xl font-black tracking-tight text-blue-600 transition-colors sm:text-2xl group-data-[transparent=true]/header:text-white">
        {brand}
      </span>
    </Link>
  );
}
