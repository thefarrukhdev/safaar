"use client";

import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Lock,
  Unlock,
  Users,
  ShieldOff,
  AlertTriangle,
  CalendarOff,
} from "lucide-react";
import { AdminApi } from "@/lib/api/admin-api";
import { extractApiErrorMessage } from "@/lib/utils";
import type {
  AdminListing,
  AvailabilityDay,
  AvailabilityDayStatus,
  RoomAvailability,
} from "@/types/admin";

/**
 * 2026-09-14 SAFAAR admin gap closure — real Availability Calendar,
 * wired to the (already existing, already tested) backend:
 *   GET    /admin/rooms/:id/availability
 *   POST   /admin/rooms/:id/block
 *   DELETE /admin/rooms/:id/block
 * Room list comes from the EXISTING GET /admin/hotels/:id response
 * (`room_types[].rooms[]`) — no new "list rooms" endpoint was needed.
 */

const STATUS_META: Record<
  AvailabilityDayStatus,
  { label: string; bg: string; fg: string; border: string }
> = {
  available: {
    label: "Bo'sh",
    bg: "rgba(46,204,113,0.12)",
    fg: "#1E8449",
    border: "rgba(46,204,113,0.35)",
  },
  partially_occupied: {
    label: "Qisman band",
    bg: "rgba(243,156,18,0.14)",
    fg: "#B9770E",
    border: "rgba(243,156,18,0.4)",
  },
  booked: {
    label: "To'liq band",
    bg: "rgba(230,126,34,0.16)",
    fg: "#A04000",
    border: "rgba(230,126,34,0.45)",
  },
  blocked: {
    label: "Bloklangan",
    bg: "rgba(231,76,60,0.14)",
    fg: "#943126",
    border: "rgba(231,76,60,0.4)",
  },
};

const WEEKDAY_LABELS = ["Du", "Se", "Cho", "Pa", "Ju", "Sh", "Ya"];

const MONTH_LABELS = [
  "Yanvar",
  "Fevral",
  "Mart",
  "Aprel",
  "May",
  "Iyun",
  "Iyul",
  "Avgust",
  "Sentyabr",
  "Oktyabr",
  "Noyabr",
  "Dekabr",
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function todayIso(): string {
  return isoDate(new Date());
}

/** Dushanba boshlanadigan oy taqvimi — har hafta 7 ta katak (null = boshqa oy). */
function buildMonthMatrix(year: number, month: number): (string | null)[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // getUTCDay(): 0=Yak..6=Shan -> Dushanba-birinchi indeksga o'tkazamiz
  const firstWeekday = (first.getUTCDay() + 6) % 7;

  const cells: (string | null)[] = Array(firstWeekday).fill(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(isoDate(new Date(Date.UTC(year, month, day))));
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (string | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function isForbidden(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    (err as { response?: { status?: number } }).response?.status === 403
  );
}

export default function RoomAvailabilityPage() {
  const params = useParams();
  const router = useRouter();
  const listingId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [listing, setListing] = useState<AdminListing | null>(null);
  const [listingLoading, setListingLoading] = useState(true);
  const [listingError, setListingError] = useState<string | null>(null);

  const [roomId, setRoomId] = useState<string>("");
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const [availability, setAvailability] = useState<RoomAvailability | null>(null);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [calendarForbidden, setCalendarForbidden] = useState(false);

  const [blockModalOpen, setBlockModalOpen] = useState(false);
  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  const [unblockModalOpen, setUnblockModalOpen] = useState(false);
  const [unblockStart, setUnblockStart] = useState("");
  const [unblockEnd, setUnblockEnd] = useState("");
  const [unblockSubmitting, setUnblockSubmitting] = useState(false);

  const rooms = useMemo(
    () =>
      (listing?.roomTypes ?? []).flatMap((type) =>
        type.rooms.map((room) => ({
          value: room.id,
          label: `${type.name} — ${room.name} (${room.code})`,
        })),
      ),
    [listing],
  );

  useEffect(() => {
    if (!listingId) return;
    const load = () => {
      setListingLoading(true);
      setListingError(null);
      AdminApi.getListing(listingId)
        .then((item) => {
          setListing(item);
          const firstRoom = (item.roomTypes ?? []).flatMap((t) => t.rooms)[0];
          if (firstRoom) setRoomId(firstRoom.id);
        })
        .catch((err) =>
          setListingError(
            extractApiErrorMessage(err, "E'lon ma'lumotlarini yuklab bo'lmadi"),
          ),
        )
        .finally(() => setListingLoading(false));
    };
    load();
  }, [listingId]);

  const monthStart = useMemo(
    () => new Date(Date.UTC(cursor.year, cursor.month, 1)),
    [cursor.year, cursor.month],
  );
  const monthEndExclusive = useMemo(
    () => new Date(Date.UTC(cursor.year, cursor.month + 1, 1)),
    [cursor.year, cursor.month],
  );
  const fromStr = isoDate(monthStart);
  const toStr = isoDate(monthEndExclusive);

  const refreshCalendar = useMemo(
    () => async () => {
      if (!roomId) return;
      setCalendarLoading(true);
      setCalendarError(null);
      setCalendarForbidden(false);
      try {
        const data = await AdminApi.getRoomAvailability(roomId, fromStr, toStr);
        setAvailability(data);
      } catch (err) {
        if (isForbidden(err)) {
          setCalendarForbidden(true);
        } else {
          setCalendarError(
            extractApiErrorMessage(err, "Availability ma'lumotini yuklab bo'lmadi"),
          );
        }
      } finally {
        setCalendarLoading(false);
      }
    },
    [roomId, fromStr, toStr],
  );

  useEffect(() => {
    const load = () => {
      if (!roomId) {
        setAvailability(null);
        return;
      }
      void refreshCalendar();
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, fromStr, toStr]);

  const dayByDate = useMemo(() => {
    const map = new Map<string, AvailabilityDay>();
    for (const day of availability?.days ?? []) map.set(day.date, day);
    return map;
  }, [availability]);

  const weeks = useMemo(
    () => buildMonthMatrix(cursor.year, cursor.month),
    [cursor.year, cursor.month],
  );

  function goToMonth(delta: number) {
    setCursor((prev) => {
      const next = new Date(Date.UTC(prev.year, prev.month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  }

  function openBlockModal(prefillDate?: string) {
    setBlockStart(prefillDate ?? "");
    setBlockEnd("");
    setBlockReason("");
    setBlockModalOpen(true);
  }

  function handleDayClick(date: string, day: AvailabilityDay | undefined) {
    if (day?.blocked) {
      setUnblockStart(date);
      setUnblockEnd("");
      setUnblockModalOpen(true);
      return;
    }
    openBlockModal(date);
  }

  async function handleBlockSubmit(e: FormEvent) {
    e.preventDefault();
    if (!roomId) return;
    if (!blockStart || !blockEnd) {
      toast.error("Boshlanish va tugash sanasini kiriting");
      return;
    }
    if (blockEnd <= blockStart) {
      toast.error("Tugash sanasi boshlanish sanasidan keyin bo'lishi kerak");
      return;
    }
    if (blockStart < todayIso()) {
      toast.error("O'tgan sanani bloklab bo'lmaydi");
      return;
    }
    if (!blockReason.trim()) {
      toast.error("Bloklash sababini kiriting");
      return;
    }
    setBlockSubmitting(true);
    try {
      const result = await AdminApi.blockRoomAvailability(
        roomId,
        blockStart,
        blockEnd,
        blockReason.trim(),
      );
      const blockedDates = Array.isArray(
        (result as { dates_blocked?: unknown })?.dates_blocked,
      )
        ? (result as { dates_blocked: unknown[] }).dates_blocked
        : [];
      toast.success(`${blockedDates.length} ta sana bloklandi`);
      setBlockModalOpen(false);
      await refreshCalendar();
    } catch (err) {
      toast.error(extractApiErrorMessage(err, "Bloklashda xatolik yuz berdi"));
    } finally {
      setBlockSubmitting(false);
    }
  }

  async function handleUnblockSubmit(e: FormEvent) {
    e.preventDefault();
    if (!roomId) return;
    const end = unblockEnd || unblockStart;
    if (!unblockStart) {
      toast.error("Sanani tanlang");
      return;
    }
    if (end < unblockStart) {
      toast.error("Tugash sanasi boshlanish sanasidan keyin bo'lishi kerak");
      return;
    }
    // Backend [start, end) yarim-ochiq oraliq kutadi — bitta kunni ochish
    // uchun end = start + 1 kun.
    const endExclusive =
      end === unblockStart
        ? isoDate(new Date(Date.parse(unblockStart) + 86_400_000))
        : end;
    setUnblockSubmitting(true);
    try {
      const result = await AdminApi.unblockRoomAvailability(
        roomId,
        unblockStart,
        endExclusive,
      );
      const unblockedDates = Array.isArray(
        (result as { dates_unblocked?: unknown })?.dates_unblocked,
      )
        ? (result as { dates_unblocked: unknown[] }).dates_unblocked
        : [];
      if (unblockedDates.length === 0) {
        toast("Bu oraliqda bloklangan sana topilmadi");
      } else {
        toast.success(`${unblockedDates.length} ta sana blokdan chiqarildi`);
      }
      setUnblockModalOpen(false);
      await refreshCalendar();
    } catch (err) {
      toast.error(extractApiErrorMessage(err, "Blokdan chiqarishda xatolik"));
    } finally {
      setUnblockSubmitting(false);
    }
  }

  if (listingLoading) {
    return (
      <div className="max-w-[1100px] mx-auto flex flex-col gap-6">
        <div className="h-6 w-48 bg-[var(--bg-tertiary)] rounded animate-pulse" />
        <Card padding="lg">
          <div className="h-64 bg-[var(--bg-tertiary)] rounded-lg animate-pulse" />
        </Card>
      </div>
    );
  }

  if (listingError || !listing) {
    return (
      <div className="max-w-[1100px] mx-auto flex flex-col gap-6">
        <Card padding="lg">
          <div className="flex flex-col items-center text-center gap-3 py-10">
            <AlertTriangle size={28} className="text-[var(--danger)]" aria-hidden />
            <p className="text-sm text-[var(--text-secondary)]">
              {listingError ?? "E'lon topilmadi"}
            </p>
            <Button variant="secondary" size="sm" onClick={() => router.refresh()}>
              Qayta urinish
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-[1100px] mx-auto flex flex-col gap-6">
      <Link
        href={`/partners/listings/${listingId}`}
        className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors w-fit"
      >
        <ArrowLeft size={16} aria-hidden />
        E&apos;longa qaytish
      </Link>

      <Card padding="lg">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              Xona sotuv availability&apos;si
            </h1>
            <p className="text-sm text-[var(--text-muted)] mt-1">{listing.hotelName}</p>
          </div>
          {rooms.length > 0 && (
            <div className="w-full sm:w-72">
              <Select
                label="Xona"
                options={rooms}
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
              />
            </div>
          )}
        </div>

        {rooms.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-3 py-16">
            <CalendarOff size={28} className="text-[var(--text-muted)]" aria-hidden />
            <p className="text-sm text-[var(--text-secondary)]">
              Bu e&apos;londa hali faol xona yo&apos;q — availability boshqarish uchun
              avval kamida bitta xona qo&apos;shilishi kerak.
            </p>
          </div>
        ) : (
          <>
            {/* Month nav */}
            <div className="flex items-center justify-between mt-6 mb-4">
              <button
                type="button"
                onClick={() => goToMonth(-1)}
                aria-label="Oldingi oy"
                className="w-9 h-9 rounded-lg flex items-center justify-center border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] cursor-pointer"
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
              <h2 className="text-base font-semibold text-[var(--text-primary)]" aria-live="polite">
                {MONTH_LABELS[cursor.month]} {cursor.year}
              </h2>
              <button
                type="button"
                onClick={() => goToMonth(1)}
                aria-label="Keyingi oy"
                className="w-9 h-9 rounded-lg flex items-center justify-center border border-[var(--border)] text-[var(--text-secondary)] hover:bg-[var(--bg-tertiary)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] cursor-pointer"
              >
                <ChevronRight size={16} aria-hidden />
              </button>
            </div>

            {/* Legend — status color-only emas, matn/icon bilan */}
            <div className="flex flex-wrap gap-3 mb-4">
              {(Object.keys(STATUS_META) as AvailabilityDayStatus[]).map((status) => (
                <span
                  key={status}
                  className="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md"
                  style={{ backgroundColor: STATUS_META[status].bg, color: STATUS_META[status].fg }}
                >
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: STATUS_META[status].fg }}
                    aria-hidden
                  />
                  {STATUS_META[status].label}
                </span>
              ))}
            </div>

            {calendarForbidden ? (
              <div className="flex flex-col items-center text-center gap-3 py-16">
                <ShieldOff size={28} className="text-[var(--danger)]" aria-hidden />
                <p className="text-sm font-medium text-[var(--text-primary)]">
                  Bu bo&apos;lim uchun ruxsatingiz yo&apos;q
                </p>
                <p className="text-xs text-[var(--text-muted)] max-w-sm">
                  Availability&apos;ni ko&apos;rish/boshqarish uchun tegishli admin
                  huquqi (availability:read / availability:block) kerak.
                </p>
              </div>
            ) : calendarError ? (
              <div className="flex flex-col items-center text-center gap-3 py-16">
                <AlertTriangle size={28} className="text-[var(--danger)]" aria-hidden />
                <p className="text-sm text-[var(--text-secondary)]">{calendarError}</p>
                <Button variant="secondary" size="sm" onClick={() => void refreshCalendar()}>
                  Qayta urinish
                </Button>
              </div>
            ) : calendarLoading ? (
              <div
                className="grid grid-cols-7 gap-1.5"
                role="status"
                aria-label="Yuklanmoqda"
              >
                {Array.from({ length: 35 }).map((_, i) => (
                  <div
                    key={i}
                    className="aspect-square rounded-lg bg-[var(--bg-tertiary)] animate-pulse"
                  />
                ))}
              </div>
            ) : (
              <table className="w-full border-collapse" role="grid" aria-label="Oylik availability taqvimi">
                <thead>
                  <tr>
                    {WEEKDAY_LABELS.map((label) => (
                      <th
                        key={label}
                        scope="col"
                        className="text-xs font-medium text-[var(--text-muted)] pb-2 text-center"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeks.map((week, wi) => (
                    <tr key={wi}>
                      {week.map((date, di) => {
                        if (!date) {
                          return <td key={di} className="p-1" aria-hidden />;
                        }
                        const day = dayByDate.get(date);
                        const status = day?.status ?? "available";
                        const meta = STATUS_META[status];
                        const dayNum = Number(date.slice(8, 10));
                        const isPast = date < todayIso();
                        return (
                          <td key={di} className="p-1">
                            <button
                              type="button"
                              disabled={isPast}
                              onClick={() => handleDayClick(date, day)}
                              aria-label={`${date} — ${meta.label}${
                                day ? `, ${day.sellableCount} ta sotuvda bo'sh` : ""
                              }${isPast ? " (o'tgan sana)" : ""}`}
                              title={`${meta.label}${day ? ` · sotuvda: ${day.sellableCount}` : ""}`}
                              className="w-full aspect-square rounded-lg border text-xs font-medium flex flex-col items-center justify-center gap-0.5 transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] disabled:opacity-40 disabled:cursor-not-allowed enabled:cursor-pointer enabled:hover:scale-[1.03]"
                              style={{
                                backgroundColor: meta.bg,
                                color: meta.fg,
                                borderColor: meta.border,
                              }}
                            >
                              <span>{dayNum}</span>
                              {status === "blocked" && <Lock size={10} aria-hidden />}
                              {status === "partially_occupied" && (
                                <Users size={10} aria-hidden />
                              )}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <div className="flex items-center gap-3 mt-6">
              <Button
                variant="danger"
                size="sm"
                icon={<Lock size={14} aria-hidden />}
                onClick={() => openBlockModal()}
              >
                Sana(lar)ni bloklash
              </Button>
              <Button
                variant="secondary"
                size="sm"
                icon={<Unlock size={14} aria-hidden />}
                onClick={() => {
                  setUnblockStart("");
                  setUnblockEnd("");
                  setUnblockModalOpen(true);
                }}
              >
                Blokdan chiqarish
              </Button>
              <p className="text-xs text-[var(--text-muted)] ml-auto">
                Kunga bosish ham tezkor bloklash/blokdan chiqarish oynasini ochadi
              </p>
            </div>
          </>
        )}
      </Card>

      {/* Block modal */}
      <Modal
        open={blockModalOpen}
        onClose={() => setBlockModalOpen(false)}
        title="Sanalarni bloklash"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setBlockModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              variant="danger"
              size="sm"
              loading={blockSubmitting}
              onClick={() => handleBlockSubmit({ preventDefault() {} } as FormEvent)}
            >
              Bloklash
            </Button>
          </>
        }
      >
        <form onSubmit={handleBlockSubmit} className="flex flex-col gap-4" id="block-form">
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="block-start" className="text-sm font-medium text-[var(--text-secondary)]">
                Boshlanish sanasi
              </label>
              <input
                id="block-start"
                type="date"
                required
                min={todayIso()}
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="block-end" className="text-sm font-medium text-[var(--text-secondary)]">
                Tugash sanasi
              </label>
              <input
                id="block-end"
                type="date"
                required
                min={blockStart || todayIso()}
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="block-reason" className="text-sm font-medium text-[var(--text-secondary)]">
              Sabab <span className="text-[var(--danger)]">*</span>
            </label>
            <textarea
              id="block-reason"
              required
              rows={3}
              value={blockReason}
              onChange={(e) => setBlockReason(e.target.value)}
              placeholder="Masalan: overbooking tuzatish, texnik xizmat, VIP mehmon uchun band qilish"
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] resize-none"
            />
          </div>
        </form>
      </Modal>

      {/* Unblock modal */}
      <Modal
        open={unblockModalOpen}
        onClose={() => setUnblockModalOpen(false)}
        title="Blokdan chiqarish"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setUnblockModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button
              variant="accent"
              size="sm"
              loading={unblockSubmitting}
              onClick={() => handleUnblockSubmit({ preventDefault() {} } as FormEvent)}
            >
              Blokdan chiqarish
            </Button>
          </>
        }
      >
        <form onSubmit={handleUnblockSubmit} className="flex flex-col gap-4" id="unblock-form">
          <p className="text-xs text-[var(--text-muted)]">
            Faqat allaqachon bloklangan sanalar ochiladi — mavjud bronlarga (haqiqiy
            bandlik) hech qanday ta&apos;sir qilmaydi.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="unblock-start" className="text-sm font-medium text-[var(--text-secondary)]">
                Boshlanish sanasi
              </label>
              <input
                id="unblock-start"
                type="date"
                required
                value={unblockStart}
                onChange={(e) => setUnblockStart(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="unblock-end" className="text-sm font-medium text-[var(--text-secondary)]">
                Tugash sanasi (ixtiyoriy — bo&apos;sh bo&apos;lsa faqat 1 kun)
              </label>
              <input
                id="unblock-end"
                type="date"
                min={unblockStart}
                value={unblockEnd}
                onChange={(e) => setUnblockEnd(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
