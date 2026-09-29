import { type ReactNode } from "react";

export interface CatalogHeaderProps {
  title: string;
  subtitle: string;
  searchControls?: ReactNode;
  filterControls?: ReactNode;
}

export function CatalogHeader({
  title,
  subtitle,
  searchControls,
  filterControls,
}: CatalogHeaderProps) {
  return (
    <div className="mb-8 border-b border-slate-200 pb-6 ">
      <h1 className="text-2xl font-black tracking-tight text-slate-900  sm:text-3xl lg:text-4xl" style={{ fontFamily: "var(--font-manrope, sans-serif)" }}>
        {title}
      </h1>
      <p className="mt-1.5 text-sm sm:text-base font-medium text-slate-600 ">
        {subtitle}
      </p>

      {/* Filter Controls Bar */}
      {(searchControls || filterControls) && (
        <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
          {searchControls && <div className="relative w-full lg:flex-1">{searchControls}</div>}
          {filterControls}
        </div>
      )}
    </div>
  );
}
