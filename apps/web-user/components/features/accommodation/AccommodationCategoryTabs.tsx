"use client";

import { Building2, Home, HeartPulse, Mountain, LayoutGrid } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { CategoryTabs, type CategoryTab } from "@/components/ui/CategoryTabs";

export function AccommodationCategoryTabs({
  locale,
  dict,
}: {
  locale: string;
  dict: Record<string, string>;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isAll = searchParams.has("all");

  const tabs: CategoryTab[] = [
    { 
      key: "all", 
      href: `/${locale}/hotels?all=true`, 
      label: dict.all ?? "Barchasi", 
      icon: LayoutGrid, 
      color: "text-blue-600",
      isActive: pathname === `/${locale}/hotels` && isAll
    },
    { 
      key: "hotels", 
      href: `/${locale}/hotels`, 
      label: dict.hotels ?? "Mehmonxonalar", 
      icon: Building2, 
      color: "text-blue-600",
      isActive: pathname === `/${locale}/hotels` && !isAll
    },
    { 
      key: "dachas", 
      href: `/${locale}/dachas`, 
      label: dict.dachas ?? "Dachalar", 
      icon: Home, 
      color: "text-emerald-500",
      isActive: pathname === `/${locale}/dachas`
    },
    { 
      key: "sanatoriums", 
      href: `/${locale}/sanatoriums`, 
      label: dict.sanatoriums ?? "Sanatoriylar", 
      icon: HeartPulse, 
      color: "text-pink-500",
      isActive: pathname === `/${locale}/sanatoriums`
    },
    { 
      key: "resorts", 
      href: `/${locale}/resorts`, 
      label: dict.resorts ?? "Oromgohlar", 
      icon: Mountain, 
      color: "text-purple-500",
      isActive: pathname === `/${locale}/resorts`
    },
  ];

  return <CategoryTabs tabs={tabs} />;
}

