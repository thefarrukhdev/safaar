'use client';

import { CheckCircle2 } from 'lucide-react';
import { cn } from '../../../_lib/utils/cn';

interface SignalProps {
  label: string;
  value: string;
  hint: string;
}

export function Signal({ label, value, hint }: SignalProps) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
      <p className="truncate text-[11px] text-[var(--muted-foreground)]">
        {hint}
      </p>
    </div>
  );
}

interface ChecklistItemProps {
  done: boolean;
  label: string;
}

export function ChecklistItem({ done, label }: ChecklistItemProps) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2
        className={cn(
          'h-4 w-4 shrink-0',
          done ? 'text-accent-600' : 'text-zinc-300 dark:text-zinc-700',
        )}
        aria-hidden
      />
      <span
        className={cn(
          done ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]',
        )}
      >
        {label}
      </span>
    </div>
  );
}

interface RuleChipProps {
  on: boolean;
  icon: React.ReactNode;
  label: string;
}

export function RuleChip({ on, icon, label }: RuleChipProps) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md px-3 py-2',
        on
          ? 'bg-accent-50 text-accent-800 dark:bg-accent-950/30 dark:text-accent-200'
          : 'bg-[var(--surface-muted)] text-[var(--muted-foreground)]',
      )}
    >
      <span className="inline-flex items-center gap-2">
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {label}
      </span>
      <span className="text-xs font-medium">{on ? 'Ruxsat' : "Yo'q"}</span>
    </div>
  );
}
