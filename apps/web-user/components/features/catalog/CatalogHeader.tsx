import { type ReactNode } from "react";

export interface CatalogHeaderProps {
  icon: ReactNode;
  badge: string;
  title: string;
  subtitle: string;
  searchControls?: ReactNode;
  filterControls?: ReactNode;
}

export function CatalogHeader({
  icon,
  badge,
  title,
  subtitle,
  searchControls,
  filterControls,
}: CatalogHeaderProps) {
  return (
    <div className="mb-8 border-b border-slate-200 pb-6 ">
      <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700   ">
        {icon}
        <span>{badge}</span>
      </div>
      <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900  sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-base text-slate-600 ">
        {subtitle}
      </p>

      {/* Filter Controls Bar */}
      {(searchControls || filterControls) && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {searchControls && <div className="relative flex-1">{searchControls}</div>}
          {filterControls}
        </div>
      )}
    </div>
  );
}
