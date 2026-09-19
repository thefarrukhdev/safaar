"use client";

import React from "react";
import { SearchX } from "lucide-react";
import { Button } from "@/components/ui/Button";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  actionHref?: string;
  className?: string;
}

export function EmptyState({
  icon = <SearchX className="h-10 w-10 text-slate-400 dark:text-slate-500" />,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-card p-8 text-center shadow-xs dark:border-slate-800 dark:bg-slate-900 ${className}`}
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
        {icon}
      </div>

      <h3 className="mt-4 text-lg font-extrabold text-slate-900 dark:text-white">
        {title}
      </h3>

      {description && (
        <p className="mt-1.5 max-w-md text-xs font-semibold text-slate-600 dark:text-slate-300">
          {description}
        </p>
      )}

      {actionLabel && (onAction || actionHref) && (
        <div className="mt-5">
          {actionHref ? (
            <a href={actionHref}>
              <Button variant="primary" size="md" className="font-bold">
                {actionLabel}
              </Button>
            </a>
          ) : (
            <Button variant="primary" size="md" onClick={onAction} className="font-bold">
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
