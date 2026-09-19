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
  icon = <SearchX className="size-10 text-slate-900/70 dark:text-white/70" aria-hidden="true" />,
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  className = "",
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-xl border border-slate-900/[0.08] bg-white p-8 text-center dark:border-white/[0.10] dark:bg-slate-900 ${className}`}
    >
      <div className="flex size-16 items-center justify-center rounded-xl bg-slate-900/[0.05] dark:bg-white/[0.08]">
        {icon}
      </div>

      <h3 className="mt-4 text-base font-medium leading-snug text-slate-900 dark:text-white">
        {title}
      </h3>

      {description && (
        <p className="mt-1.5 max-w-md text-sm text-slate-900/70 dark:text-white/70">
          {description}
        </p>
      )}

      {actionLabel && (onAction || actionHref) && (
        <div className="mt-5">
          {actionHref ? (
            <a href={actionHref}>
              <Button variant="primary" size="md">
                {actionLabel}
              </Button>
            </a>
          ) : (
            <Button variant="primary" size="md" onClick={onAction}>
              {actionLabel}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
