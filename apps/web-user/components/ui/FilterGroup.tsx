"use client";

import React, { useState } from "react";
import { ChevronDown } from "lucide-react";

export interface FilterGroupProps {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function FilterGroup({
  title,
  defaultExpanded = true,
  children,
}: FilterGroupProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border-b border-slate-900/[0.08] py-3 dark:border-white/[0.10]">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between py-1 text-left rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2"
      >
        <span className="text-sm font-semibold text-slate-900 dark:text-white">
          {title}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-slate-900/60 dark:text-white/60 transition-transform duration-200 ease-[cubic-bezier(0.2,0,0,1)] ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {expanded && (
        <div className="mt-2.5 flex flex-col gap-2">
          {children}
        </div>
      )}
    </div>
  );
}
