"use client";

import { Bell, BellOff, CalendarPlus, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { BookingStatus } from "@safaar/types";
import { useReservations } from "../../_hooks/use-reservations";
import { TODAY_ISO } from "../../_lib/utils/date";
import { formatDate, formatPhone } from "../../_lib/utils/format";
import { Tooltip } from "../ui/tooltip";
import { Button } from "../ui/button";

/**
 * Bell tugmasi: kutilayotgan bronlar va bugun keladigan mehmonlarni
 * dropdown'da ko'rsatadi.
 */
export function NotificationsButton() {
  const { data } = useReservations();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const notifications = useMemo(() => {
    const pending = data.filter((r) => r.status === BookingStatus.PENDING);
    const arrivalsToday = data.filter(
      (r) => r.checkIn === TODAY_ISO && r.status === BookingStatus.CONFIRMED,
    );
    return { pending, arrivalsToday };
  }, [data]);

  const total = notifications.pending.length + notifications.arrivalsToday.length;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <Tooltip content="Bildirishnomalar" side="bottom">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => setOpen((v) => !v)}
          aria-label={`Bildirishnomalar (${total})`}
          aria-haspopup="menu"
          aria-expanded={open}
          className="relative h-9 w-9 text-zinc-500 hover:bg-[var(--surface-hover)]"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {total > 0 && (
            <span
              className="absolute right-1 top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white"
              aria-hidden="true"
            >
              {total > 9 ? "9+" : total}
            </span>
          )}
        </Button>
      </Tooltip>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-2 w-80 overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-xl fade-in"
        >
          <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3">
            <h3 className="text-sm font-semibold">Bildirishnomalar</h3>
            {total > 0 && (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">
                {total}
              </span>
            )}
          </div>

          {total === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
              <BellOff
                className="h-8 w-8 text-zinc-400"
                aria-hidden
              />
              <p className="text-sm font-medium">Hammasi joyida</p>
              <p className="text-xs text-[var(--muted-foreground)]">
                Yangi bildirishnomalar yo'q
              </p>
            </div>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {notifications.pending.length > 0 && (
                <li className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Tasdiq kutmoqda
                </li>
              )}
              {notifications.pending.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/reservations/${r.id}`}
                    onClick={() => setOpen(false)}
                    role="menuitem"
                    className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0 hover:bg-[var(--surface-muted)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                      <CalendarPlus className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="truncate text-sm font-medium">
                        {r.guest.fullName}
                      </p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {r.roomTypeName} · {formatDate(r.checkIn)}
                      </p>
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        {formatPhone(r.guest.phone)}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}

              {notifications.arrivalsToday.length > 0 && (
                <li className="px-4 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)]">
                  Bugun keladi
                </li>
              )}
              {notifications.arrivalsToday.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/reservations/${r.id}`}
                    onClick={() => setOpen(false)}
                    role="menuitem"
                    className="flex items-start gap-3 border-b border-[var(--border)] px-4 py-3 last:border-0 hover:bg-[var(--surface-muted)]"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700">
                      <CheckCircle2 className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <p className="truncate text-sm font-medium">
                        {r.guest.fullName}
                      </p>
                      <p className="truncate text-xs text-[var(--muted-foreground)]">
                        {r.roomTypeName}
                        {r.roomNumber && ` · ${r.roomNumber}`}
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          <div className="border-t border-[var(--border)] bg-[var(--surface-muted)] px-4 py-2 text-center">
            <Link
              href="/reservations"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Barcha bronlarni ko'rish →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
