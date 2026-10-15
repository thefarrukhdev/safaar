'use client';

import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../../_lib/utils/cn';

export type SectionId =
  | 'general'
  | 'photos'
  | 'amenities'
  | 'location'
  | 'rules'
  | 'roomTypes'
  | 'rooms';

export interface ListingSection {
  id: SectionId;
  title: string;
  subtitle: string;
  action: string;
  complete: boolean;
  summary: string;
  icon: React.ReactNode;
  missing?: string;
}

interface WorkflowStepProps {
  index: number;
  section: ListingSection;
  active: boolean;
  onEdit: () => void;
}

export function WorkflowStep({
  index,
  section,
  active,
  onEdit,
}: WorkflowStepProps) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        'grid gap-3 rounded-card border bg-[var(--surface)] p-4 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center',
        section.complete
          ? 'border-[var(--border)]'
          : active
            ? 'border-amber-300 dark:border-amber-800'
            : 'border-[var(--border)]',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold',
          section.complete
            ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/35 dark:text-accent-200'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-200',
        )}
      >
        {section.complete ? (
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        ) : (
          index
        )}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{section.title}</h3>
          {active && !section.complete && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              keyingi
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          {section.subtitle}
        </p>
        <p className="mt-2 truncate text-sm">{section.summary}</p>
        {section.missing && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {section.missing}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-300">
          {section.icon}
          {section.action}
        </span>
      </div>
    </button>
  );
}
