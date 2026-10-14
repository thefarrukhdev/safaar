"use client";

import {
  CalendarRange,
  Command as CommandIcon,
  Search,
  User,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useBodyScrollLock } from "../../_hooks/use-body-scroll-lock";
import { useMounted } from "../../_hooks/use-mounted";
import { useReservations } from "../../_hooks/use-reservations";
import { useGuests } from "../../_hooks/use-guests";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels } from "../../_lib/utils/partner-labels";
import { getNavGroups } from "./sidebar-nav";
import { cn } from "../../_lib/utils/cn";
import { formatPhone } from "../../_lib/utils/format";
import { Button } from "../ui/button";

interface ResultItem {
  id: string;
  label: string;
  sublabel?: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  href: string;
  group: "Bronlar" | "Mijozlar" | "Sahifalar";
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const mounted = useMounted();

  const { data: reservations } = useReservations();
  const { data: guests } = useGuests();

  // Klaviatura shortcut — ⌘K yoki Ctrl+K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useBodyScrollLock(open);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const user = useAuthStore((s) => s.user);
  const partnerType = user?.partnerType || "hotel";
  const labels = getPartnerLabels(partnerType);

  const results = useMemo<ResultItem[]>(() => {
    const q = query.trim().toLowerCase();
    const items: ResultItem[] = [];

    // Pages (always show at top when query is empty)
    for (const group of getNavGroups(partnerType)) {
      for (const item of group.items) {
        if (!q || item.label.toLowerCase().includes(q)) {
          items.push({
            id: `page-${item.href}`,
            label: item.label,
            icon: item.icon,
            href: item.href,
            group: "Sahifalar",
          });
        }
      }
    }

    if (q) {
      // Reservations by ID, guest name, phone
      for (const r of reservations) {
        if (
          r.id.toLowerCase().includes(q) ||
          r.guest.fullName.toLowerCase().includes(q) ||
          r.guest.phone.includes(q.replace(/\D/g, ""))
        ) {
          items.push({
            id: `res-${r.id}`,
            label: `${r.id} — ${r.guest.fullName}`,
            sublabel: `${r.roomTypeName}${r.roomNumber ? ` · ${r.roomNumber}` : ""} · ${formatPhone(r.guest.phone)}`,
            icon: CalendarRange,
            href: `/reservations/${r.id}`,
            group: "Bronlar",
          });
        }
      }

      // Guests by name/phone
      for (const g of guests) {
        if (
          g.fullName.toLowerCase().includes(q) ||
          g.phone.includes(q.replace(/\D/g, ""))
        ) {
          items.push({
            id: `guest-${g.id}`,
            label: g.fullName,
            sublabel: `${formatPhone(g.phone)} · ${g.totalStays} tashrif`,
            icon: User,
            href: `/guests/${g.id}`,
            group: "Mijozlar",
          });
        }
      }

    }

    return items.slice(0, 30);
  }, [query, reservations, guests, partnerType]);

  const groups = useMemo(() => {
    const map = new Map<string, ResultItem[]>();
    for (const item of results) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [results]);

  const handleSelect = (item: ResultItem) => {
    router.push(item.href);
    setOpen(false);
  };

  const handleOpen = () => {
    setQuery("");
    setSelectedIdx(0);
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIdx((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIdx]) {
        e.preventDefault();
        handleSelect(results[selectedIdx]);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, selectedIdx]);

  if (!mounted) return <TriggerButton onClick={handleOpen} />;

  return (
    <>
      <TriggerButton onClick={handleOpen} />
      {open &&
        createPortal(
          <div className="fixed inset-0 z-[100]">
            <div
              onClick={() => setOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              aria-hidden
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Global qidiruv"
              className="relative mx-auto mt-24 flex max-h-[70vh] w-full max-w-2xl flex-col overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
            >
              {/* Search input */}
              <div className="flex items-center gap-2 border-b border-[var(--border)] px-4">
                <Search
                  className="h-4 w-4 text-zinc-400"
                  aria-hidden
                />
                <input
                  ref={inputRef}
                  type="search"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setSelectedIdx(0);
                  }}
                  placeholder={`Bron ID, mijoz, ${labels.unitSingular} yoki sahifa qidiring...`}
                  className="flex-1 border-0 bg-[var(--surface)] py-4 text-sm focus:outline-none"
                  aria-label="Qidiruv"
                />
                <kbd className="hidden rounded border border-[var(--border)] bg-[var(--surface-muted)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--muted-foreground)] sm:inline">
                  Esc
                </kbd>
              </div>

              {/* Results */}
              <div className="flex-1 overflow-y-auto">
                {results.length === 0 ? (
                  <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
                    <Search
                      className="h-8 w-8 text-zinc-300 dark:text-zinc-600"
                      aria-hidden
                    />
                    <p className="text-sm text-[var(--muted-foreground)]">
                      {query ? "Hech narsa topilmadi" : "Qidiruvni boshlang"}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col p-2">
                    {groups.map(([groupName, items]) => (
                      <div key={groupName} className="flex flex-col">
                        <div className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
                          {groupName}
                        </div>
                        {items.map((item) => {
                          const idx = results.indexOf(item);
                          const isSelected = idx === selectedIdx;
                          const Icon = item.icon;
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setSelectedIdx(idx)}
                              className={cn(
                                "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left",
                                isSelected
                                  ? "bg-brand-50 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100"
                                  : "hover:bg-[var(--surface-muted)]",
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
                                  isSelected
                                    ? "bg-brand-700 text-white"
                                    : "bg-[var(--surface-muted)] text-[var(--muted-foreground)]",
                                )}
                              >
                                <Icon className="h-4 w-4" aria-hidden />
                              </span>
                              <div className="flex min-w-0 flex-1 flex-col">
                                <span className="truncate text-sm font-medium">
                                  {item.label}
                                </span>
                                {item.sublabel && (
                                  <span
                                    className={cn(
                                      "truncate text-xs",
                                      isSelected
                                        ? "text-brand-700 dark:text-brand-300"
                                        : "text-[var(--muted-foreground)]",
                                    )}
                                  >
                                    {item.sublabel}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between border-t border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-[10px] text-[var(--muted-foreground)]">
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5">
                      ↑↓
                    </kbd>
                    tanlash
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <kbd className="rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5">
                      ↵
                    </kbd>
                    ochish
                  </span>
                </div>
                <span>{results.length} natija</span>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

function TriggerButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onClick}
      className="hidden items-center gap-2 px-3 py-1.5 text-sm text-[var(--muted-foreground)] bg-[var(--surface-muted)] hover:bg-[var(--surface)] lg:inline-flex min-h-0"
      aria-label="Qidiruv ochish"
    >
      <Search className="h-4 w-4" aria-hidden="true" />
      <span>Qidirish...</span>
      <kbd className="ml-2 inline-flex items-center gap-0.5 rounded border border-[var(--border)] bg-[var(--surface)] px-1 py-0.5 text-[10px]">
        <CommandIcon className="h-2.5 w-2.5" aria-hidden="true" />K
      </kbd>
    </Button>
  );
}
