"use client";

import { useMemo, useState } from "react";
import {
  BedDouble,
  BedSingle,
  Check,
  DoorOpen,
  Filter,
  Search,
  Zap,
} from "lucide-react";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { useBeds } from "../../_hooks/use-beds";
import { useRooms } from "../../_hooks/use-rooms";
import { useReservations, useAssignRoom } from "../../_hooks/use-reservations";
import { RoomStatus, type Bed, type ReservationView, type Room } from "../../_lib/domain/types";
import { cn } from "../../_lib/utils/cn";

interface Props {
  open: boolean;
  onClose: () => void;
  reservation: ReservationView | null;
  /** Yotoq tanlangandan keyingi harakat. */
  onAssigned?: (roomNumber: string) => void;
}

export function AssignBedDialog(props: Props) {
  if (!props.open) return null;
  return <AssignBedDialogContent key={props.reservation?.id ?? "dialog"} {...props} />;
}

function AssignBedDialogContent({
  open,
  onClose,
  reservation,
  onAssigned,
}: Props) {
  const { data: rooms = [] } = useRooms();
  const { data: beds = [] } = useBeds();
  const { data: reservations = [] } = useReservations();
  const assignRoom = useAssignRoom();

  const [selected, setSelected] = useState<{ room: Room; bed: Bed } | null>(() => {
    if (!reservation?.bedId) return null;
    const foundBed = beds.find((b) => b.id === reservation.bedId);
    const foundRoom = rooms.find((r) => r.id === foundBed?.roomId);
    return foundBed && foundRoom ? { room: foundRoom, bed: foundBed } : null;
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [filterOnlyAvailable, setFilterOnlyAvailable] = useState(false);

  const matchingRooms = useMemo(
    () => (reservation ? rooms.filter((r) => r.roomTypeId === reservation.roomTypeId) : []),
    [rooms, reservation],
  );

  /**
   * Bed.status faqat "hozir jismonan band"ni bildiradi.
   * Kelajakdagi bronlar bilan sana to'qnashuvini hisoblaymiz.
   */
  const isBedAvailable = (bed: Bed): boolean => {
    if (bed.status !== RoomStatus.VACANT_CLEAN || !reservation) return false;
    const hasConflict = reservations.some((r) => {
      if (r.id === reservation.id || r.bedId !== bed.id) return false;
      if (
        r.status === BookingStatus.CANCELLED ||
        r.status === BookingStatus.EXPIRED ||
        r.status === BookingStatus.COMPLETED
      ) {
        return false;
      }
      return r.checkIn < reservation.checkOut && reservation.checkIn < r.checkOut;
    });
    return !hasConflict;
  };

  const availableBedsCount = useMemo(
    () =>
      matchingRooms.reduce(
        (sum, room) =>
          sum + beds.filter((b) => b.roomId === room.id && isBedAvailable(b)).length,
        0,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [matchingRooms, beds, reservations, reservation],
  );

  // Qavatlar bo'yicha saralash va qidiruv filtrlash
  const floors = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const map = new Map<number, Room[]>();

    matchingRooms.forEach((room) => {
      const roomBeds = beds.filter((b) => b.roomId === room.id);
      const matchesSearch =
        !q ||
        room.number.toLowerCase().includes(q) ||
        roomBeds.some((b) => b.label.toLowerCase().includes(q));

      if (!matchesSearch) return;

      if (filterOnlyAvailable) {
        const hasAvail = roomBeds.some((b) => isBedAvailable(b));
        if (!hasAvail) return;
      }

      if (!map.has(room.floor)) map.set(room.floor, []);
      map.get(room.floor)!.push(room);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, floorRooms]) => ({
        floor,
        rooms: floorRooms.sort((a, b) => a.number.localeCompare(b.number)),
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchingRooms, beds, searchQuery, filterOnlyAvailable, reservations, reservation]);

  const firstAvailableBed = useMemo(() => {
    for (const room of matchingRooms) {
      const bed = beds
        .filter((b) => b.roomId === room.id)
        .sort((a, b) => a.label.localeCompare(b.label))
        .find((b) => isBedAvailable(b));
      if (bed) return { room, bed };
    }
    return null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchingRooms, beds, reservations, reservation]);

  const assignAndClose = (room: Room, bed: Bed, auto: boolean) => {
    if (!reservation) return;
    assignRoom.mutate(
      {
        id: reservation.id,
        roomNumber: room.number,
        bedId: bed.id,
      },
      {
        onSuccess: () => {
          toast.success(
            auto
              ? `${room.number} · ${bed.label} avtomatik tayinlandi.`
              : `${room.number} · ${bed.label} tayinlandi.`,
          );
          onAssigned?.(room.number);
          setSelected(null);
          onClose();
        },
        onError: (err) => {
          toast.error(err instanceof Error ? err.message : "Yotoq biriktirishda xatolik");
        },
      },
    );
  };

  const handleAutoAssign = () => {
    if (!firstAvailableBed) return;
    assignAndClose(firstAvailableBed.room, firstAvailableBed.bed, true);
  };

  const handleConfirm = () => {
    if (!selected) return;
    assignAndClose(selected.room, selected.bed, false);
  };

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      title="Aqlli yotoq biriktirish"
      description={
        reservation ? `${reservation.guest.fullName} · Bron: ${reservation.roomTypeName}` : ""
      }
      size="lg"
      footer={
        <div className="flex w-full items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-zinc-400 truncate">
            {selected ? (
              <span>
                Tanlandi:{" "}
                <strong className="font-semibold text-slate-900 dark:text-zinc-100">
                  Xona {selected.room.number} · {selected.bed.label}
                </strong>
              </span>
            ) : (
              <span>Iltimos, ro'yxatdan yotoqni tanlang</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={assignRoom.isPending}
            >
              Bekor qilish
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!selected || assignRoom.isPending}
              loading={assignRoom.isPending}
              className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-sm transition-all"
            >
              {selected ? "Yotoqni biriktirish" : "Yotoq tanlang"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* Recommendation banner */}
        {reservation && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-blue-200/80 bg-blue-50/70 p-4 backdrop-blur-sm dark:border-blue-900/40 dark:bg-blue-950/30">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 shadow-2xs dark:bg-blue-900/60 dark:text-blue-300">
                <BedDouble className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
                  Mos keladigan {availableBedsCount} ta bo'sh yotoq bor
                </p>
                <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
                  Dormitory xonalar ichidagi bo'sh joylar yashil rang bilan ko'rsatilmoqda.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={handleAutoAssign}
              disabled={!firstAvailableBed || assignRoom.isPending}
              loading={assignRoom.isPending}
              className="bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white shadow-sm transition-all text-xs"
            >
              <Zap className="h-3.5 w-3.5 mr-1" aria-hidden />
              Avtomatik tayinlash
            </Button>
          </div>
        )}

        {/* Search & Filter Controls */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Xona raqami yoki yotoq nomi bo'yicha qidirish..."
              className="h-9 pl-9 text-xs"
            />
          </div>

          <button
            type="button"
            onClick={() => setFilterOnlyAvailable((prev) => !prev)}
            className={cn(
              "flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors select-none",
              filterOnlyAvailable
                ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800",
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            <span>Faqat bo'sh yotoqlar</span>
          </button>
        </div>

        {/* Beds Grid Grouped by Floor & Room */}
        <div className="flex flex-col gap-6 max-h-[50vh] overflow-y-auto pr-1.5 custom-scrollbar">
          {floors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <DoorOpen className="h-10 w-10 text-slate-300 dark:text-zinc-700 mb-2" />
              <p className="text-sm font-semibold text-slate-700 dark:text-zinc-300">
                Mos yotoq topilmadi
              </p>
              <p className="text-xs text-slate-400 dark:text-zinc-500 mt-0.5">
                Qidiruv so'zini o'zgartiring yoki filtrlarni tozalang.
              </p>
            </div>
          ) : (
            floors.map(({ floor, rooms: floorRooms }) => (
              <div key={floor} className="flex flex-col gap-3">
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200/90 bg-white/90 py-1.5 backdrop-blur-md dark:border-zinc-800/90 dark:bg-zinc-900/90">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-zinc-300">
                    {floor}-Qavat
                  </h3>
                  <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                    {floorRooms.length} ta xona
                  </span>
                </div>

                <div className="flex flex-col gap-3.5">
                  {floorRooms.map((room) => {
                    const roomBeds = beds
                      .filter((b) => b.roomId === room.id)
                      .sort((a, b) => a.label.localeCompare(b.label));

                    return (
                      <div
                        key={room.id}
                        className="flex flex-col gap-2 rounded-2xl border border-slate-200/70 bg-slate-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
                            Xona {room.number} {room.roomTypeName ? `(${room.roomTypeName})` : ""}
                          </span>
                          <span className="text-[11px] text-slate-400 dark:text-zinc-500">
                            {roomBeds.length} ta yotoq
                          </span>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                          {roomBeds.map((bed) => {
                            const isMatch = isBedAvailable(bed);
                            const isSelected = selected?.bed.id === bed.id;

                            return (
                              <SmartBedOption
                                key={bed.id}
                                bed={bed}
                                isMatch={isMatch}
                                selected={isSelected}
                                onSelect={() => {
                                  if (isMatch) setSelected({ room, bed });
                                }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Dialog>
  );
}

function SmartBedOption({
  bed,
  isMatch,
  selected,
  onSelect,
}: {
  bed: Bed;
  isMatch: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={!isMatch}
      className={cn(
        "group relative flex flex-col items-center gap-1.5 rounded-xl border p-2.5 text-center transition-all duration-150 select-none",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30",
        selected
          ? "border-blue-600 bg-blue-50/90 shadow-sm ring-2 ring-blue-500/25 dark:border-blue-500 dark:bg-blue-950/60 dark:ring-blue-500/40"
          : isMatch
            ? "border-emerald-200/80 bg-emerald-50/40 hover:border-emerald-400 hover:bg-emerald-50/80 hover:shadow-2xs active:scale-[0.98] cursor-pointer dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:hover:bg-emerald-950/40"
            : "border-slate-100 bg-slate-50/50 opacity-40 cursor-not-allowed grayscale dark:border-zinc-800 dark:bg-zinc-900/30",
      )}
    >
      {selected && (
        <div className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-white shadow-2xs">
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        </div>
      )}
      <BedSingle
        className={cn(
          "h-4 w-4 transition-transform group-hover:scale-110",
          selected
            ? "text-blue-700 dark:text-blue-300"
            : isMatch
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-slate-400 dark:text-zinc-600",
        )}
      />
      <span className="text-[11px] font-semibold text-slate-700 dark:text-zinc-200 line-clamp-1">
        {bed.label}
      </span>
    </button>
  );
}
