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
      <div className="pointer-events-none absolute left-0 top-0 bottom-2 z-10 w-6 bg-gradient-to-r from-white to-transparent dark:from-slate-950 md:hidden" />

      <div className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden relative z-0 flex w-full gap-3 overflow-x-auto pb-2 pt-1 px-4 sm:px-6 lg:px-10">
        {tabs.map((tab) => {
          const isTabActive =
            tab.isActive !== undefined
              ? tab.isActive
              : tab.href && pathname
              ? pathname === tab.href || pathname.startsWith(tab.href + "?")
              : false;

          const Icon = tab.icon;

          const className = cn(
            "group relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full px-4 h-9 text-sm font-medium transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.97] select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none motion-reduce:active:scale-100",
            isTabActive
              ? "bg-slate-900 text-white hover:bg-slate-900/90 dark:bg-white dark:text-slate-900 dark:hover:bg-white/90"
              : "bg-slate-900/[0.05] text-slate-900 hover:bg-slate-900/[0.08] dark:bg-white/[0.08] dark:text-white dark:hover:bg-white/[0.12]"
          );

          const iconColor = tab.color ?? (isTabActive ? "text-white dark:text-slate-900" : "text-slate-900/70 dark:text-white/70 group-hover:text-slate-900 dark:group-hover:text-white");

          const content = (
            <>
              {Icon && (
                <Icon
                  className={cn(
                    "size-5 shrink-0 transition-transform duration-200",
                    iconColor
                  )}
                  aria-hidden="true"
                />
              )}
              <span>{tab.label}</span>
            </>
          );

          return tab.href ? (
            <Link key={tab.key} href={tab.href} className={className} onClick={tab.onClick} aria-pressed={isTabActive}>
              {content}
            </Link>
          ) : (
            <button key={tab.key} type="button" onClick={tab.onClick} className={className} aria-pressed={isTabActive}>
              {content}
            </button>
          );
        })}
      </div>

      {/* Fade gradient right */}
      <div className="pointer-events-none absolute right-0 top-0 bottom-2 z-10 w-8 bg-gradient-to-l from-white to-transparent dark:from-slate-950 md:hidden" />
    </div>
  );
}

