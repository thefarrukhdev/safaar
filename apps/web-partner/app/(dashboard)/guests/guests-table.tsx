"use client";

import {
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  ExternalLink,
  MoreVertical,
  Phone,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../_components/ui/badge";
import { Button } from "../../_components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../_components/ui/dropdown-menu";
import type { GuestProfile } from "../../_lib/domain/types";
import { formatDate, formatMoney, formatPhone } from "../../_lib/utils/format";
import type { GuestCalculatedStats } from "./types";

interface GuestsTableProps {
  guests: GuestProfile[];
  guestStats: Map<string, GuestCalculatedStats>;
  isBus: boolean;
  guestLabel: string;
  totalFilteredCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
  onRowClick: (guest: GuestProfile) => void;
  onNewBookingForGuest: (guest: GuestProfile) => void;
}

export function GuestsTable({
  guests,
  guestStats,
  isBus,
  guestLabel,
  totalFilteredCount,
  page,
  pageSize,
  totalPages,
  onPageChange,
  onPageSizeChange,
  onRowClick,
  onNewBookingForGuest,
}: GuestsTableProps) {
  const handleCopyPhone = async (phone: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(phone);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = phone;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      toast.success("Telefon raqami nusxalandi");
    } catch {
      toast.error("Raqamni nusxalab bo'lmadi");
    }
  };

  const currentPage = Math.min(page, totalPages);
  const startItem = totalFilteredCount === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalFilteredCount);

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto rounded-card border border-[var(--border)] bg-[var(--surface)]">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
            <tr>
              <th className="px-4 py-3">{guestLabel}</th>
              <th className="px-4 py-3">Aloqa</th>
              <th className="px-4 py-3">{isBus ? "Ijaralar" : "Tashriflar"}</th>
              <th className="px-4 py-3">Sarflagan</th>
              <th className="px-4 py-3">{isBus ? "Oxirgi ijara" : "Oxirgi tashrif"}</th>
              <th className="px-4 py-3">Belgilar</th>
              <th className="w-12 px-4 py-3 text-right">Amallar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {guests.map((g) => {
              const stats = guestStats.get(g.id) ?? {
                totalStays: 0,
                totalSpent: 0,
                lastStay: undefined,
                rejectedStays: 0,
              };

              const initials = g.fullName
                .trim()
                .split(/\s+/)
                .filter(Boolean)
                .map((w) => w[0])
                .slice(0, 2)
                .join("")
                .toUpperCase() || "M";

              const phoneRaw = g.phone.trim();
              const telLink = phoneRaw.startsWith("+") ? `tel:${phoneRaw}` : `tel:+${phoneRaw}`;

              return (
                <tr
                  key={g.id}
                  onClick={() => onRowClick(g)}
                  className="group cursor-pointer transition-colors hover:bg-[var(--surface-muted)]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-xs font-bold text-brand-700 dark:from-brand-900/60 dark:to-brand-800/40 dark:text-brand-300">
                        {initials}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1.5 truncate font-medium group-hover:text-brand-600 transition-colors">
                          {g.fullName}
                          {g.isVip && (
                            <span title="VIP mijoz">
                              <Crown
                                className="h-3.5 w-3.5 shrink-0 text-amber-500 fill-amber-500/20"
                                aria-label="VIP mijoz"
                              />
                            </span>
                          )}
                        </span>
                        {g.email && (
                          <span className="truncate text-xs text-[var(--muted-foreground)]">
                            {g.email}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <a
                        href={telLink}
                        onClick={(e) => e.stopPropagation()}
                        className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline dark:text-brand-300 font-mono"
                        title="Qo'ng'iroq qilish"
                      >
                        <Phone className="h-3 w-3" aria-hidden />
                        {formatPhone(g.phone)}
                      </a>
                      <button
                        type="button"
                        onClick={(e) => handleCopyPhone(g.phone, e)}
                        className="rounded p-1 text-zinc-400 opacity-0 group-hover:opacity-100 hover:text-zinc-700 dark:hover:text-zinc-200 transition-opacity"
                        title="Telefon raqamini nusxalash"
                        aria-label="Telefon raqamini nusxalash"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </td>

                  <td className="px-4 py-3">
                    <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                      {stats.totalStays}
                    </span>
                    <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                      marta
                    </span>
                  </td>

                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                    {formatMoney(stats.totalSpent)}
                  </td>

                  <td className="px-4 py-3 text-xs text-[var(--muted-foreground)]">
                    {stats.lastStay ? formatDate(stats.lastStay) : "—"}
                  </td>

                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-1">
                      {g.isVip && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                          <Crown className="h-2.5 w-2.5" />
                          VIP
                        </span>
                      )}
                      {stats.rejectedStays > 0 && (
                        <Badge tone="danger">
                          {stats.rejectedStays} ta rad etilgan
                        </Badge>
                      )}
                      {g.tags.map((t) => (
                        <Badge key={t} tone="brand">
                          {t}
                        </Badge>
                      ))}
                    </div>
                  </td>

                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
                          aria-label={`${g.fullName} uchun amallar`}
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" side="bottom" className="w-52">
                        <DropdownMenuLabel>{g.fullName}</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => onRowClick(g)}>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          <span>Tafsilotlar</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => handleCopyPhone(g.phone, e)}>
                          <Copy className="mr-2 h-4 w-4" />
                          <span>Telefon nusxalash</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <a href={telLink}>
                            <Phone className="mr-2 h-4 w-4" />
                            <span>Qo'ng'iroq qilish</span>
                          </a>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onNewBookingForGuest(g)}>
                          <CalendarPlus className="mr-2 h-4 w-4 text-brand-600 dark:text-brand-400" />
                          <span className="font-medium text-brand-700 dark:text-brand-300">
                            Yangi bron yaratish
                          </span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Sahifalash (Pagination) boshqaruvi */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-2 text-xs text-[var(--muted-foreground)]">
        <div>
          Jami {totalFilteredCount} ta natijadan{" "}
          <span className="font-semibold text-[var(--foreground)]">
            {startItem}-{endItem}
          </span>{" "}
          ko'rsatilmoqda
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span>Sahifada:</span>
            <select
              aria-label="Sahifadagi qatorlar soni"
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs focus:outline-none"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(Math.max(1, currentPage - 1))}
              aria-label="Oldingi sahifa"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="px-2 font-medium text-[var(--foreground)]">
              {currentPage} / {totalPages}
            </span>

            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
              aria-label="Keyingi sahifa"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
