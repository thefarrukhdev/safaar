"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export interface CategoryTab {
  key: string;
  href?: string;
  label: string;
  icon?: React.ElementType;
  color?: string;
  isActive?: boolean;
  onClick?: () => void;
}

export interface CategoryTabsProps {
  tabs: CategoryTab[];
}

export function CategoryTabs({ tabs }: CategoryTabsProps) {
  const pathname = usePathname();

  return (
    <div className="relative mb-6 w-full">
      {/* Fade gradient left */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-2 z-10 w-6 bg-gradient-to-r from-slate-50 to-transparent dark:from-slate-950 md:hidden" />

      <div className="scrollbar-none relative z-0 flex w-full gap-3 overflow-x-auto pb-2 pt-1 snap-x snap-mandatory px-1 md:justify-center">
        {tabs.map((tab) => {
          const isTabActive =
            tab.isActive !== undefined
              ? tab.isActive
              : tab.href && pathname
              ? pathname === tab.href || pathname.startsWith(tab.href + "?")
              : false;

          const Icon = tab.icon;

          const className = cn(
            "group relative flex shrink-0 cursor-pointer snap-center items-center justify-center gap-2.5 rounded-xl px-5 py-3 text-sm font-extrabold transition-all duration-200 select-none",
            isTabActive
              ? "bg-white text-slate-900 shadow-md ring-2 ring-blue-600 dark:bg-slate-900 dark:text-white dark:ring-blue-500"
              : "bg-white/90 text-slate-700 border border-slate-200/90 shadow-xs hover:bg-white hover:text-slate-900 hover:shadow-md hover:border-slate-300 dark:bg-slate-900/80 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-900 dark:hover:text-white"
          );

          const iconColor = tab.color ?? (isTabActive ? "text-blue-600" : "text-slate-500 group-hover:text-slate-800");

          const content = (
            <>
              {Icon && (
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200 group-hover:scale-110",
                    iconColor
                  )}
                  strokeWidth={isTabActive ? 2.5 : 2}
                />
              )}
              <span>{tab.label}</span>
            </>
          );

          return tab.href ? (
            <Link key={tab.key} href={tab.href} className={className} onClick={tab.onClick}>
              {content}
            </Link>
          ) : (
            <button key={tab.key} type="button" onClick={tab.onClick} className={className}>
              {content}
            </button>
          );
        })}
      </div>

      {/* Fade gradient right */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-2 z-10 w-8 bg-gradient-to-l from-slate-50 to-transparent dark:from-slate-950 md:hidden" />
    </div>
  );
}

