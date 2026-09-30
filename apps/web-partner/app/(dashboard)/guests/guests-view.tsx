"use client";

import { Crown, Phone, Search, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { BookingStatus } from "@safaar/types";
import { Badge } from "../../_components/ui/badge";
import { EmptyState } from "../../_components/ui/empty-state";
import { Input } from "../../_components/ui/input";
import { PageHeader } from "../../_components/layout/page-header";
import { useGuests } from "../../_hooks/use-guests";
import { useReservations } from "../../_hooks/use-reservations";
import { formatDate, formatMoney, formatPhone } from "../../_lib/utils/format";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels, hasBuses } from "../../_lib/utils/partner-labels";

export function GuestsView() {
  const { data } = useGuests();
  const { data: reservations } = useReservations();
  const router = useRouter();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const [query, setQuery] = useState("");
  const [vipOnly, setVipOnly] = useState(false);

  /**
   * `totalStays`/`totalSpent`/`lastStay` mock ma'lumotdagi statik maydonlar
   * edi — yangi bron qo'shilganda yangilanmasdi. Endi har bir mijoz uchun
   * haqiqiy bronlardan jonli hisoblanadi.
   */
  const guestStats = useMemo(() => {
    const map = new Map<string, { totalStays: number; totalSpent: number; lastStay?: string; rejectedStays: number }>();
    for (const g of data) {
      const bookings = reservations.filter(
        (r) => r.guest.id === g.id || r.guest.phone === g.phone,
      );
      const active = bookings.filter(
        (b) => b.status !== BookingStatus.CANCELLED && b.status !== BookingStatus.EXPIRED,
      );
      const rejected = bookings.filter(
        (b) => b.status === BookingStatus.CANCELLED || b.status === BookingStatus.EXPIRED,
      );
      const completed = [...bookings]
        .filter((b) => b.status === BookingStatus.COMPLETED)
        .sort((a, b) => (b.checkIn > a.checkIn ? 1 : -1));
      map.set(g.id, {
        totalStays: active.length,
        totalSpent: active.reduce((sum, b) => sum + b.paidAmount, 0),
        lastStay: completed[0]?.checkIn,
        rejectedStays: rejected.length,
      });
    }
    return map;
  }, [data, reservations]);

  const filtered = useMemo(() => {
    let list = data;
    if (vipOnly) list = list.filter((g) => g.isVip);
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter((g) =>
        [g.fullName, g.phone, g.email ?? ""].join(" ").toLowerCase().includes(q),
      );
    }
    return list;
  }, [data, query, vipOnly]);

  const vipCount = data.filter((g) => g.isVip).length;

  const isBus = hasBuses(partnerType);
  const guestPlural = isBus ? "Ijarachilar" : "Mijozlar";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow={labels.guestLabel}
        title={guestPlural}
        description={`${labels.guestLabel} profili, ijaralar va xaridlar tarixi.`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative max-w-sm flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
            aria-hidden
          />
          <Input
            type="search"
            placeholder="Ism yoki telefon bo'yicha qidirish..."
            className="pl-9"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`${guestPlural} ichidan qidirish`}
          />
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-sm hover:bg-[var(--surface-muted)]">
          <input
            type="checkbox"
            checked={vipOnly}
            onChange={(e) => setVipOnly(e.target.checked)}
            className="h-4 w-4 accent-brand-700"
          />
          <Crown className="h-4 w-4 text-amber-500" aria-hidden />
          <span>Faqat VIP</span>
          {vipCount > 0 && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
              {vipCount}
            </span>
          )}
        </label>
        <span className="text-sm text-[var(--muted-foreground)]">
          {filtered.length} ta natija
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<Users className="h-10 w-10" aria-hidden />}
          title={`${labels.guestLabel} topilmadi`}
          description={
            vipOnly || query
              ? "Filterni o'zgartirib ko'ring yoki boshqa kalit so'z yozing."
              : `${labels.guestLabel}lar ijaraga olganda shu yerda paydo bo'ladi.`
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-card border border-[var(--border)] bg-[var(--surface)]">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="border-b border-[var(--border)] bg-[var(--surface-muted)] text-left text-xs uppercase tracking-wide text-[var(--muted-foreground)]">
              <tr>
                <th className="px-4 py-3">{labels.guestLabel}</th>
                <th className="px-4 py-3">Aloqa</th>
                <th className="px-4 py-3">{isBus ? "Ijaralar" : "Tashriflar"}</th>
                <th className="px-4 py-3">Sarflagan</th>
                <th className="px-4 py-3">{isBus ? "Oxirgi ijara" : "Oxirgi tashrif"}</th>
                <th className="px-4 py-3">Belgilar</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((g) => {
                const stats = guestStats.get(g.id) ?? { totalStays: 0, totalSpent: 0, lastStay: undefined, rejectedStays: 0 };
                return (
                <tr
                  key={g.id}
                  onClick={() => router.push(`/guests/${g.id}`)}
                  className="cursor-pointer border-b border-[var(--border)] transition-colors last:border-0 hover:bg-[var(--surface-muted)]"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-sm font-bold text-brand-700">
                        {g.fullName
                          .trim()
                          .split(/\s+/)
                          .filter(Boolean)
                          .map((w) => w[0])
                          .slice(0, 2)
                          .join("")}
                      </span>
                      <div className="flex min-w-0 flex-col">
                        <span className="flex items-center gap-1 truncate font-medium">
                          {g.fullName}
                          {g.isVip && (
                            <Crown
                              className="h-3.5 w-3.5 shrink-0 text-amber-500"
                              aria-label="VIP"
                            />
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
                    <a
                      href={g.phone.startsWith("+") ? `tel:${g.phone}` : `tel:+${g.phone}`}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1 text-brand-700 hover:underline dark:text-brand-300"
                    >
                      <Phone className="h-3 w-3" aria-hidden />
                      {formatPhone(g.phone)}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold">{stats.totalStays}</span>
                    <span className="ml-1 text-xs text-[var(--muted-foreground)]">
                      marta
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {formatMoney(stats.totalSpent)}
                  </td>
                  <td className="px-4 py-3 text-[var(--muted-foreground)]">
                    {stats.lastStay ? formatDate(stats.lastStay) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
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
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
