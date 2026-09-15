"use client";

import { BedDouble, BedSingle, UtensilsCrossed, Users, CarFront, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PageHeader } from "../../_components/layout/page-header";
import { useBeds } from "../../_hooks/use-beds";
import { useRooms, useUpdateRoom, useDeleteRoom } from "../../_hooks/use-rooms";
import { useRoomTypes } from "../../_hooks/use-room-types";
import { RoomStatus, type Bed, type Room, type RoomType } from "../../_lib/domain/types";
import { UnifiedRoomDialog } from "../settings/rooms/_dialogs/unified-room-dialog";
import { BedManagementDialog } from "../settings/rooms/_dialogs/bed-management-dialog";
import { EmptyState, LoadingState, ErrorState } from "../../_components/ui/empty-state";
import { Button } from "../../_components/ui/button";
import { formatMoney } from "../../_lib/utils/format";
import { useAuthStore } from "../../_stores/auth-store";
import { useDataStore } from "../../_stores/data-store";
import { getPartnerLabels, hasBeds, hasBuses, isDacha, isRestaurant } from "../../_lib/utils/partner-labels";

export function RoomsView() {
  const router = useRouter();
  const { data: rooms, isLoading, isError, refetch } = useRooms();
  const { data: roomTypes } = useRoomTypes();
  useBeds();
  const beds = useDataStore((s) => s.beds);
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const isHostel = hasBeds(partnerType);
  const isDachaType = isDacha(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);

  const { mutate: deleteRoom } = useDeleteRoom();

  const [addingRoom, setAddingRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [managingBedsFor, setManagingBedsFor] = useState<Room | null>(null);

  useEffect(() => {
    if (isDachaType) router.replace("/listing");
  }, [isDachaType, router]);

  // Qavatlar bo'yicha guruhlash
  const floors = useMemo(() => {
    const map = new Map<number, Room[]>();
    rooms
      .filter((room) => !room.number.startsWith("DELETED_"))
      .forEach(room => {
      if (!map.has(room.floor)) {
        map.set(room.floor, []);
      }
      map.get(room.floor)!.push(room);
    });

    // Qavatlarni o'sish tartibida (1, 2, 3...) va xonalarni raqami bo'yicha tartiblash
    const sortedFloors = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, floorRooms]) => {
        return {
          floor,
          rooms: floorRooms.sort((a, b) => a.number.localeCompare(b.number))
        };
      });

    return sortedFloors;
  }, [rooms]);

  if (isDachaType) return null;

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Operatsion"
          title={labels.unitsPageTitle}
          description={labels.unitsPageDescription}
        />
        <div className="mt-4 sm:mt-0">
          {floors && floors.length > 0 && (
            <Button onClick={() => setAddingRoom(true)}>
              {isBus ? (
                <CarFront className="mr-2 h-4 w-4" />
              ) : restaurant ? (
                <UtensilsCrossed className="mr-2 h-4 w-4" />
              ) : (
                <BedDouble className="mr-2 h-4 w-4" />
              )}
              {labels.addUnitLabel}
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-10">
        {isLoading ? (
          <LoadingState title={`${labels.unitPlural} yuklanmoqda...`} />
        ) : isError ? (
          <ErrorState 
            title={`${labels.unitPlural}ni yuklashda xatolik yuz berdi`} 
            action={<Button onClick={() => refetch()} variant="outline" size="sm">Qayta urinish</Button>} 
          />
        ) : floors.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-zinc-200 bg-zinc-50/50 py-20 px-6 text-center dark:border-zinc-800 dark:bg-zinc-900/20">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100/50 text-brand-600 dark:bg-brand-900/30 dark:text-brand-400 mb-4">
              {isBus ? <CarFront className="h-8 w-8" /> : restaurant ? <UtensilsCrossed className="h-8 w-8" /> : <BedDouble className="h-8 w-8" />}
            </div>
            <h3 className="text-xl font-bold text-zinc-900 dark:text-white">
              Hali hech qanday {labels.unitSingular} qo'shilmagan
            </h3>
            <p className="mt-2 mb-6 max-w-md text-sm text-zinc-500 dark:text-zinc-400">
              Yangi {labels.unitSingular.toLowerCase()} qo'shish tugmasini bosib birinchisini yarating.
            </p>
            <Button onClick={() => setAddingRoom(true)}>
              {labels.addUnitLabel}
            </Button>
          </div>
        ) : (
          floors.map(({ floor, rooms }) => (
            <section key={floor} className="flex flex-col gap-4">
              <div className="flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {floor}-{labels.floorSingular.charAt(0).toUpperCase()}{labels.floorSingular.slice(1)}
                </h2>
                <span className="text-sm font-medium text-zinc-500">
                  {rooms.length} ta {labels.unitSingular}
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {rooms.map(room => {
                  const roomType = roomTypes.find(t => t.id === room.roomTypeId);
                  const roomBeds = isHostel ? beds.filter((b) => b.roomId === room.id) : [];
                  return (
                    <RoomCard
                      key={room.id}
                      room={room}
                      roomType={roomType}
                      beds={isHostel ? roomBeds : undefined}
                      restaurant={restaurant}
                      isBus={isBus}
                      onEdit={() => setEditingRoom(room)}
                      onDelete={() => {
                        if (window.confirm(`Rostdan ham ${room.number} raqamli ${labels.unitSingular.toLowerCase()}ni o'chirmoqchimisiz?`)) {
                          deleteRoom(room.id);
                        }
                      }}
                      onManageBeds={isHostel ? () => setManagingBedsFor(room) : undefined}
                      labels={labels}
                    />
                  );
                })}
              </div>
            </section>
          ))
        )}
      </div>

      <UnifiedRoomDialog
        open={addingRoom}
        onClose={() => setAddingRoom(false)}
        mode="room"
      />

      <UnifiedRoomDialog
        open={!!editingRoom}
        onClose={() => setEditingRoom(null)}
        mode="room"
        editing={roomTypes?.find(t => t.id === editingRoom?.roomTypeId) ?? null}
        editingPhysicalRoom={editingRoom}
      />

      <BedManagementDialog
        open={!!managingBedsFor}
        onClose={() => setManagingBedsFor(null)}
        room={managingBedsFor}
      />
    </div>
  );
}

function RoomCard({
  room,
  roomType,
  beds,
  restaurant,
  isBus,
  onEdit,
  onDelete,
  onManageBeds,
  labels,
}: {
  room: Room;
  roomType?: RoomType;
  beds?: Bed[];
  restaurant: boolean;
  isBus?: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onManageBeds?: () => void;
  labels: any;
}) {
  const freeBeds = beds?.filter((b) => b.status === RoomStatus.VACANT_CLEAN).length ?? 0;
  const { mutate: updateRoom, isPending: isUpdating } = useUpdateRoom();

  const handleToggleStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = room.status === RoomStatus.OUT_OF_SERVICE ? RoomStatus.VACANT_CLEAN : RoomStatus.OUT_OF_SERVICE;
    
    // We only send the fields required by RoomDraft, assuming useUpdateRoom accepts partial or full room draft
    updateRoom({
      id: room.id,
      values: {
        number: room.number,
        floor: room.floor,
        roomTypeId: room.roomTypeId,
        status: nextStatus as any,
        isListed: room.isListed,
      }
    });
  };

  return (
    <div
      className={`relative flex h-full w-full flex-col rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:shadow-md dark:border-zinc-800 dark:bg-[var(--surface-muted)] ${!room.isListed ? 'opacity-50 bg-zinc-50 dark:bg-zinc-900/50 grayscale-[50%]' : room.status === RoomStatus.OUT_OF_SERVICE ? 'opacity-70' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <button 
            type="button" 
            onClick={onEdit}
            className="text-2xl font-bold text-zinc-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400 transition-colors text-left"
            title="Tahrirlash"
          >
            {room.number}
          </button>
          {!room.isListed && (
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
              YASHIRILGAN
            </span>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2">
            <button
              onClick={onEdit}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-50 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-900/40 dark:text-zinc-400 dark:hover:bg-zinc-800 transition-colors"
              title="Tahrirlash"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
            <button
              onClick={onDelete}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-colors border border-transparent hover:border-red-200"
              title="O'chirish"
            >
              <Trash2 className="h-4 w-4" />
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400">
              {isBus ? (
                <CarFront className="h-4 w-4" />
              ) : restaurant ? (
                <UtensilsCrossed className="h-4 w-4" />
              ) : (
                <BedDouble className="h-4 w-4" />
              )}
            </div>
          </div>
          {isBus && (
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${room.status === RoomStatus.OUT_OF_SERVICE ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {room.status === RoomStatus.OUT_OF_SERVICE ? 'Faol emas' : 'Faol'}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-1.5">
        <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200 line-clamp-1">
          {room.roomTypeName}
        </span>

        <div className="flex items-center gap-3 text-xs font-medium text-zinc-500">
          <span className="flex items-center gap-1">
            <Users className="h-3.5 w-3.5" />
            {roomType?.capacity || "?"} {labels.capacitySuffix}
          </span>
          {roomType?.bedType && (
            <span className="flex items-center gap-1 text-zinc-400">
              · {roomType.bedType}
            </span>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
        {!restaurant && (
          <div>
            <span className="text-[11px] font-medium text-[var(--muted-foreground)]">
              {labels.priceLabel}
            </span>
            <div className="font-semibold text-brand-700 dark:text-brand-300 mt-0.5">
              {room.nightlyPrice ?? roomType?.basePrice ? formatMoney(room.nightlyPrice ?? roomType!.basePrice) : "—"}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {isBus && (
            <button
              type="button"
              onClick={handleToggleStatus}
              disabled={isUpdating}
              className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-medium transition-colors ${
                room.status === RoomStatus.OUT_OF_SERVICE
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100'
              }`}
            >
              {isUpdating ? "Kuting..." : (room.status === RoomStatus.OUT_OF_SERVICE ? 'Faollashtirish' : 'O\'chirish')}
            </button>
          )}

          {beds && onManageBeds && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onManageBeds();
              }}
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-[11px] font-medium text-zinc-600 hover:bg-[var(--surface-muted)] dark:text-zinc-300"
            >
              <BedSingle className="h-3 w-3" aria-hidden />
              {freeBeds}/{beds.length} bo'sh
            </button>
          )}
        </div>
      </div>

      <div className="mt-auto pt-4 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
        <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Sotuvda ko'rsatish
        </span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={room.isListed}
            disabled={isUpdating}
            onChange={(e) => {
              updateRoom({
                id: room.id,
                values: {
                  isListed: e.target.checked,
                }
              });
            }}
          />
          <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500/30 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-brand-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
        </label>
      </div>
    </div>
  );
}
