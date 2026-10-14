'use client';

import { ChevronDown, LogOut, Settings, UserCircle2 } from 'lucide-react';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import { cn } from '../../_lib/utils/cn';
import { formatPhone } from '../../_lib/utils/format';
import { useAuthStore } from '../../_stores/auth-store';
import { getPartnerLabels } from '../../_lib/utils/partner-labels';

interface UserMenuProps {
  name: string;
  contact: string;
  onLogout: () => void;
}

function formatContact(contact: string) {
  return contact.includes('@') ? contact : formatPhone(contact);
}

export function UserMenu({ name, contact, onLogout }: UserMenuProps) {
  const user = useAuthStore((s) => s.user);

  const initials = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            'group flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1 pl-1 pr-2.5 text-sm transition-all duration-150',
            'hover:bg-[var(--surface-hover)] hover:border-[var(--border-strong)]',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30',
            'data-[state=open]:bg-[var(--surface-muted)] data-[state=open]:border-[var(--border-strong)]',
          )}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-xs font-semibold text-white shadow-sm">
            {initials || 'H'}
          </span>
          <span className="hidden text-left text-xs leading-tight lg:block">
            <span className="block font-medium text-zinc-900 dark:text-zinc-100">{name}</span>
            <span className="block text-[var(--muted-foreground)]">
              {formatContact(contact)}
            </span>
          </span>
          <ChevronDown
            className="h-3.5 w-3.5 text-zinc-400 transition-transform duration-200 group-data-[state=open]:rotate-180"
            aria-hidden
          />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" side="bottom" sideOffset={6} className="w-64 p-1.5">
        <div className="border-b border-zinc-100 dark:border-zinc-800/80 px-3 py-2.5">
          <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{name}</p>
          <p className="truncate text-xs text-[var(--muted-foreground)] mt-0.5">
            {formatContact(contact)}
          </p>
        </div>

        <div className="py-1">
          <DropdownMenuItem asChild>
            <Link
              href="/settings/profile"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium"
            >
              <UserCircle2 className="h-4 w-4 text-zinc-500" aria-hidden />
              <span>Profil</span>
            </Link>
          </DropdownMenuItem>

          <DropdownMenuItem asChild>
            <Link
              href="/settings/hotel"
              className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium"
            >
              <Settings className="h-4 w-4 text-zinc-500" aria-hidden />
              <span>Sozlamalar</span>
            </Link>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator />

        <div className="px-2.5 py-1.5">
          <DropdownMenuLabel className="px-0 py-0 text-[10px]">
            Obyekt turi
          </DropdownMenuLabel>
          <p className="mt-0.5 text-xs font-medium text-zinc-800 dark:text-zinc-200">
            {getPartnerLabels(user?.partnerType).topbarSubtitle}
          </p>
        </div>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          destructive
          onClick={onLogout}
          className="flex items-center gap-2.5 px-2.5 py-1.5 text-xs font-medium"
        >
          <LogOut className="h-4 w-4 text-red-500 dark:text-red-400" aria-hidden />
          <span>Chiqish</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
