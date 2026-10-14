"use client";

import {
  BedDouble,
  BedSingle,
  UtensilsCrossed,
  Users,
  CarFront,
  Trash2,
  Pencil,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { PageHeader } from "../../_components/layout/page-header";
import { useBeds } from "../../_hooks/use-beds";
import { useRooms, useUpdateRoom, useDeleteRoom } from "../../_hooks/use-rooms";
import { useRoomTypes } from "../../_hooks/use-room-types";
import { RoomStatus, type Bed, type Room, type RoomType } from "../../_lib/domain/types";
import { UnifiedRoomDialog } from "./_dialogs/unified-room-dialog";
import { BedManagementDialog } from "./_dialogs/bed-management-dialog";
import { EmptyState, LoadingState, ErrorState } from "../../_components/ui/empty-state";
import { Button } from "../../_components/ui/button";
import { useConfirm } from "../../_components/ui/confirm-dialog";
import { BulkActionBar } from "../../_components/domain/bulk-action-bar";
import { formatMoney } from "../../_lib/utils/format";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels, hasBeds, hasBuses, isDacha, isRestaurant } from "../../_lib/utils/partner-labels";
import { cn } from "../../_lib/utils/cn";

export function RoomsView() {
  const router = useRouter();
  const { data: rooms = [], isLoading, isError, refetch } = useRooms();
  const { data: roomTypes = [] } = useRoomTypes();
  const { data: beds = [] } = useBeds();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const isHostel = hasBeds(partnerType);
  const isDachaType = isDacha(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);

  const { mutate: deleteRoom } = useDeleteRoom();
  const { mutateAsync: updateRoomAsync } = useUpdateRoom();
  const confirm = useConfirm();

  const [addingRoom, setAddingRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [managingBedsFor, setManagingBedsFor] = useState<Room | null>(null);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Qidiruv va filtrlash holatlari
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<number | "all">("all");
  const [selectedType, setSelectedType] = useState<string | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<RoomStatus | "all">("all");
  const [sortBy, setSortBy] = useState<"number" | "status">("number");

  const handleToggleRoom = (id: string) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedRoomIds(new Set());
  };

  useEffect(() => {
    if (isDachaType) router.replace("/listing");
  }, [isDachaType, router]);

  // Faol, o'chirilmagan xonalar
  const validRooms = useMemo(() => {
    return rooms.filter((room) => !room.number.startsWith("DELETED_"));
  }, [rooms]);

  // Tezkor operatsion ko'rsatkichlar (KPI)
  const metrics = useMemo(() => {
    const total = validRooms.length;
    const clean = validRooms.filter((r) => r.status === RoomStatus.VACANT_CLEAN).length;
    const dirty = validRooms.filter((r) => r.status === RoomStatus.VACANT_DIRTY).length;
    const occupied = validRooms.filter((r) => r.status === RoomStatus.OCCUPIED).length;
    const outOfService = validRooms.filter((r) => r.status === RoomStatus.OUT_OF_SERVICE).length;
    return { total, clean, dirty, occupied, outOfService };
  }, [validRooms]);

  // Mavjud qavatlar ro'yxati
  const availableFloors = useMemo(() => {
    const set = new Set<number>();
    validRooms.forEach((r) => set.add(r.floor));
    return Array.from(set).sort((a, b) => a - b);
  }, [validRooms]);

  // Filtrlangan xonalar
  const filteredRooms = useMemo(() => {
    return validRooms.filter((room) => {
      if (selectedFloor !== "all" && room.floor !== selectedFloor) return false;
      if (selectedType !== "all" && room.roomTypeId !== selectedType) return false;
      if (selectedStatus !== "all" && room.status !== selectedStatus) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesNum = room.number.toLowerCase().includes(q);
        const matchesType = room.roomTypeName?.toLowerCase().includes(q);
        if (!matchesNum && !matchesType) return false;
      }
      return true;
    });
  }, [validRooms, selectedFloor, selectedType, selectedStatus, searchQuery]);

  // Qavatlar bo'yicha guruhlash va tartiblash
  const floors = useMemo(() => {
    const map = new Map<number, Room[]>();
    filteredRooms.forEach((room) => {
      if (!map.has(room.floor)) {
        map.set(room.floor, []);
      }
      map.get(room.floor)!.push(room);
    });

    const sortedFloors = Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, floorRooms]) => {
        const sorted = [...floorRooms].sort((a, b) => {
          if (sortBy === "status") {
            return a.status.localeCompare(b.status);
          }
          return a.number.localeCompare(b.number, undefined, { numeric: true, sensitivity: "base" });
        });
        return {
          floor,
          rooms: sorted,
        };
      });

    return sortedFloors;
  }, [filteredRooms, sortBy]);

  const handleBulkStatusChange = async (newStatus: string) => {
    const ids = Array.from(selectedRoomIds);
    setIsBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => {
          const r = rooms.find((room) => room.id === id);
          if (!r) return Promise.resolve();
          return updateRoomAsync({
            id: r.id,
            values: {
              number: r.number,
              floor: r.floor,
              roomTypeId: r.roomTypeId,
              status: newStatus as RoomStatus,
              isListed: r.isListed,
            },
          });
        }),
      );
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected").length;

      if (rejected === 0) {
        toast.success(`${fulfilled} ta ${labels.unitSingular.toLowerCase()} holati yangilandi`);
        setSelectedRoomIds(new Set());
      } else {
        toast.warning(`${fulfilled} ta muvaffaqiyatli, ${rejected} tasida xatolik yuz berdi`);
        const failedIds = new Set(
          ids.filter((_, idx) => results[idx].status === "rejected"),
        );
        setSelectedRoomIds(failedIds);
      }
      refetch();
    } catch {
      toast.error("Guruhli yangilashda xatolik yuz berdi");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkConfirmAll = async () => {
    const ids = Array.from(selectedRoomIds);
    setIsBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => {
          const r = rooms.find((room) => room.id === id);
          if (!r) return Promise.resolve();
          return updateRoomAsync({
            id: r.id,
            values: {
              number: r.number,
              floor: r.floor,
              roomTypeId: r.roomTypeId,
              status: RoomStatus.VACANT_CLEAN,
              isListed: true,
            },
          });
        }),
      );
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected").length;

      if (rejected === 0) {
        toast.success(`${fulfilled} ta ${labels.unitSingular.toLowerCase()} toza holatga o'tkazildi`);
        setSelectedRoomIds(new Set());
      } else {
        toast.warning(`${fulfilled} ta muvaffaqiyatli, ${rejected} tasida xatolik yuz berdi`);
        const failedIds = new Set(
          ids.filter((_, idx) => results[idx].status === "rejected"),
        );
        setSelectedRoomIds(failedIds);
      }
      refetch();
    } catch {
      toast.error("Ommaviy tasdiqlashda xatolik");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const handleBulkCancelAll = async () => {
    const ok = await confirm({
      title: `${labels.unitPlural}ni ta'mirga olish`,
      description: `Tanlangan ${selectedRoomIds.size} ta ${labels.unitSingular.toLowerCase()}ni ta'mir / xizmat ko'rsatilmaydi holatiga o'tkazmoqchimisiz?`,
      confirmText: "O'tkazish",
      cancelText: "Bekor qilish",
      destructive: true,
    });
    if (!ok) return;

    const ids = Array.from(selectedRoomIds);
    setIsBulkProcessing(true);
    try {
      const results = await Promise.allSettled(
        ids.map((id) => {
          const r = rooms.find((room) => room.id === id);
          if (!r) return Promise.resolve();
          return updateRoomAsync({
            id: r.id,
            values: {
              number: r.number,
              floor: r.floor,
              roomTypeId: r.roomTypeId,
              status: RoomStatus.OUT_OF_SERVICE,
              isListed: r.isListed,
            },
          });
        }),
      );
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected").length;

      if (rejected === 0) {
        toast.success(`${fulfilled} ta ${labels.unitSingular.toLowerCase()} ta'mirga olindi`);
        setSelectedRoomIds(new Set());
      } else {
        toast.warning(`${fulfilled} ta muvaffaqiyatli, ${rejected} tasida xatolik yuz berdi`);
        const failedIds = new Set(
          ids.filter((_, idx) => results[idx].status === "rejected"),
        );
        setSelectedRoomIds(failedIds);
      }
      refetch();
    } catch {
      toast.error("Xatolik yuz berdi");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const roomStatusOptions = useMemo(
    () => [
      { label: "Toza (Vacant Clean)", value: RoomStatus.VACANT_CLEAN, color: "#10b981" },
      { label: "Nopok (Vacant Dirty)", value: RoomStatus.VACANT_DIRTY, color: "#f59e0b" },
      { label: "Band (Occupied)", value: RoomStatus.OCCUPIED, color: "#3b82f6" },
      { label: "Ta'mirda (Out of Service)", value: RoomStatus.OUT_OF_SERVICE, color: "#ef4444" },
    ],
    [],
  );

  if (isDachaType) return null;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Operatsion"
          title={labels.unitsPageTitle}
          description={labels.unitsPageDescription}
        />
        <div className="mt-4 sm:mt-0">
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
        </div>
      </div>

      {/* Housekeeping va operatsion KPI ko'rsatkichlar */}
      {validRooms.length > 0 && (
        <section className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button
            type="button"
            onClick={() => setSelectedStatus("all")}
            className={cn(
              "flex flex-col rounded-xl border p-3.5 text-left transition-all",
              selectedStatus === "all"
                ? "border-brand-500 bg-brand-50/50 shadow-sm dark:border-brand-600 dark:bg-brand-950/20"
                : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50"
            )}
          >
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Jami {labels.unitPlural.toLowerCase()}</span>
            <span className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{metrics.total} ta</span>
          </button>

          {!isBus && (
            <>
              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === RoomStatus.VACANT_CLEAN ? "all" : RoomStatus.VACANT_CLEAN)}
                className={cn(
                  "flex flex-col rounded-xl border p-3.5 text-left transition-all",
                  selectedStatus === RoomStatus.VACANT_CLEAN
                    ? "border-emerald-500 bg-emerald-50/50 shadow-sm dark:border-emerald-600 dark:bg-emerald-950/20"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50"
                )}
              >
                <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Bo'sh & Tayyor</span>
                <span className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">{metrics.clean} ta</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === RoomStatus.VACANT_DIRTY ? "all" : RoomStatus.VACANT_DIRTY)}
                className={cn(
                  "flex flex-col rounded-xl border p-3.5 text-left transition-all",
                  selectedStatus === RoomStatus.VACANT_DIRTY
                    ? "border-amber-500 bg-amber-50/50 shadow-sm dark:border-amber-600 dark:bg-amber-950/20"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50"
                )}
              >
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">Tozalanmoqda</span>
                <span className="mt-1 text-2xl font-bold text-amber-700 dark:text-amber-400">{metrics.dirty} ta</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === RoomStatus.OCCUPIED ? "all" : RoomStatus.OCCUPIED)}
                className={cn(
                  "flex flex-col rounded-xl border p-3.5 text-left transition-all",
                  selectedStatus === RoomStatus.OCCUPIED
                    ? "border-blue-500 bg-blue-50/50 shadow-sm dark:border-blue-600 dark:bg-blue-950/20"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50"
                )}
              >
                <span className="text-xs font-medium text-blue-700 dark:text-blue-400">Band (Mehmon bor)</span>
                <span className="mt-1 text-2xl font-bold text-blue-700 dark:text-blue-400">{metrics.occupied} ta</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedStatus(selectedStatus === RoomStatus.OUT_OF_SERVICE ? "all" : RoomStatus.OUT_OF_SERVICE)}
                className={cn(
                  "flex flex-col rounded-xl border p-3.5 text-left transition-all",
                  selectedStatus === RoomStatus.OUT_OF_SERVICE
                    ? "border-red-500 bg-red-50/50 shadow-sm dark:border-red-600 dark:bg-red-950/20"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50"
                )}
              >
                <span className="text-xs font-medium text-red-700 dark:text-red-400">Ta'mirda</span>
                <span className="mt-1 text-2xl font-bold text-red-700 dark:text-red-400">{metrics.outOfService} ta</span>
              </button>
            </>
          )}
        </section>
      )}

      {/* Filtrlash va Qidiruv boshqaruv paneli */}
      {validRooms.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-[var(--surface-muted)]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`${labels.unitSingular} raqami yoki turi...`}
              className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:bg-zinc-800"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Qavat filtri */}
            {availableFloors.length > 1 && (
              <select
                aria-label={labels.floorSingular}
                value={selectedFloor}
                onChange={(e) => setSelectedFloor(e.target.value === "all" ? "all" : Number(e.target.value))}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="all">Barcha qavatlar</option>
                {availableFloors.map((fl) => (
                  <option key={fl} value={fl}>
                    {fl}-{labels.floorSingular}
                  </option>
                ))}
              </select>
            )}

            {/* Xona turi filtri */}
            {roomTypes.length > 0 && (
              <select
                aria-label={labels.unitTypeLabel}
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="all">Barcha turlar</option>
                {roomTypes.map((rt) => (
                  <option key={rt.id} value={rt.id}>
                    {rt.name}
                  </option>
                ))}
              </select>
            )}

            {/* Holat filtri */}
            {!isBus && (
              <select
                aria-label="Holat filtri"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
              >
                <option value="all">Barcha holatlar</option>
                <option value={RoomStatus.VACANT_CLEAN}>Bo'sh & Tayyor (Toza)</option>
                <option value={RoomStatus.VACANT_DIRTY}>Tozalanmoqda (Notoza)</option>
                <option value={RoomStatus.OCCUPIED}>Band</option>
                <option value={RoomStatus.OUT_OF_SERVICE}>Ta'mirda</option>
                <option value={RoomStatus.BLOCKED}>Bloklangan</option>
              </select>
            )}

            {/* Saralash */}
            <select
              aria-label="Saralash"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="number">Raqam bo'yicha</option>
              <option value="status">Holati bo'yicha</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-8">
        {isLoading ? (
          <LoadingState title={`${labels.unitPlural} yuklanmoqda...`} />
        ) : isError ? (
          <ErrorState 
            title={`${labels.unitPlural}ni yuklashda xatolik yuz berdi`} 
            action={<Button onClick={() => refetch()} variant="outline" size="sm">Qayta urinish</Button>} 
          />
        ) : validRooms.length === 0 ? (
          <EmptyState
            icon={isBus ? <CarFront className="h-8 w-8" /> : restaurant ? <UtensilsCrossed className="h-8 w-8" /> : <BedDouble className="h-8 w-8" />}
            title={`Hali hech qanday ${labels.unitSingular.toLowerCase()} qo'shilmagan`}
            description={`Yangi ${labels.unitSingular.toLowerCase()} qo'shish tugmasini bosib birinchisini yarating.`}
            action={
              <Button onClick={() => setAddingRoom(true)}>
                {labels.addUnitLabel}
              </Button>
            }
          />
        ) : filteredRooms.length === 0 ? (
          <EmptyState
            title={`Qidiruv natijasida ${labels.unitSingular.toLowerCase()} topilmadi`}
            description="Qidiruv so'zini yoki tanlangan filtrlarni o'zgartiring."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setSelectedFloor("all");
                  setSelectedType("all");
                  setSelectedStatus("all");
                }}
              >
                Filtrlarni tozalash
              </Button>
            }
          />
        ) : (
          floors.map(({ floor, rooms: floorRooms }) => (
            <section key={floor} className="flex flex-col gap-4">
              <div className="flex items-center gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-2">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-white">
                  {floor}-{labels.floorSingular.charAt(0).toUpperCase()}{labels.floorSingular.slice(1)}
                </h2>
                <span className="text-sm font-medium text-zinc-500">
                  {floorRooms.length} ta {labels.unitSingular}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {floorRooms.map((room) => {
                  const roomType = roomTypes.find((t) => t.id === room.roomTypeId);
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
                      onDelete={async () => {
                        const ok = await confirm({
                          title: `${room.number} raqamli ${labels.unitSingular.toLowerCase()}ni o'chirish`,
                          description: `Rostdan ham ${room.number} raqamli ${labels.unitSingular.toLowerCase()}ni o'chirmoqchimisiz? Bu amalni bekor qilib bo'lmaydi.`,
                          confirmText: "O'chirish",
                          cancelText: "Bekor qilish",
                          destructive: true,
                        });
                        if (ok) {
                          deleteRoom(room.id, {
                            onSuccess: () => {
                              toast.success(`${room.number} raqamli ${labels.unitSingular.toLowerCase()} muvaffaqiyatli o'chirildi`);
                            },
                            onError: (err: any) => {
                              toast.error(err?.payload?.message || err?.message || "O'chirishda xatolik yuz berdi");
                            },
                          });
                        }
                      }}
                      onManageBeds={isHostel ? () => setManagingBedsFor(room) : undefined}
                      labels={labels}
                      isSelected={selectedRoomIds.has(room.id)}
                      onToggleSelect={() => handleToggleRoom(room.id)}
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
        editing={roomTypes?.find((t) => t.id === editingRoom?.roomTypeId) ?? null}
        editingPhysicalRoom={editingRoom}
      />

      <BedManagementDialog
        open={!!managingBedsFor}
        onClose={() => setManagingBedsFor(null)}
        room={managingBedsFor}
      />

      <BulkActionBar
        selectedCount={selectedRoomIds.size}
        onClear={handleClearSelection}
        entityName={`${labels.unitSingular.toLowerCase()} tanlandi`}
        onConfirmAll={handleBulkConfirmAll}
        onCancelAll={handleBulkCancelAll}
        onChangeStatus={handleBulkStatusChange}
        statusOptions={roomStatusOptions}
        isProcessing={isBulkProcessing}
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
  isSelected,
  onToggleSelect,
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
  isSelected?: boolean;
  onToggleSelect?: () => void;
}) {
  const freeBeds = beds?.filter((b) => b.status === RoomStatus.VACANT_CLEAN).length ?? 0;
  const { mutate: updateRoom, isPending: isUpdating } = useUpdateRoom();

  const handleStatusChange = (newStatus: RoomStatus) => {
    updateRoom(
      {
        id: room.id,
        values: {
          number: room.number,
          floor: room.floor,
          roomTypeId: room.roomTypeId,
          status: newStatus,
          isListed: room.isListed,
        },
      },
      {
        onSuccess: () => {
          toast.success(`${room.number} holati yangilandi`);
        },
        onError: () => {
          toast.error("Holatni yangilashda xatolik yuz berdi");
        },
      }
    );
  };

  const handleToggleBusStatus = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = room.status === RoomStatus.OUT_OF_SERVICE ? RoomStatus.VACANT_CLEAN : RoomStatus.OUT_OF_SERVICE;
    updateRoom(
      {
        id: room.id,
        values: {
          number: room.number,
          floor: room.floor,
          roomTypeId: room.roomTypeId,
          status: nextStatus,
          isListed: room.isListed,
        },
      },
      {
        onSuccess: () => {
          toast.success(`${room.number} holati yangilandi`);
        },
      }
    );
  };

  return (
    <div
      className={cn(
        "relative flex h-full w-full flex-col rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-sm transition-all duration-200 hover:shadow-md dark:border-zinc-800 dark:bg-[var(--surface-muted)]",
        !room.isListed && "opacity-60 bg-zinc-50 dark:bg-zinc-900/50 grayscale-[40%]",
        room.status === RoomStatus.OUT_OF_SERVICE && "border-red-200/80 dark:border-red-900/40",
        isSelected && "ring-2 ring-brand-500 border-brand-500 bg-brand-50/20 dark:bg-brand-950/20",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <input
            type="checkbox"
            checked={!!isSelected}
            onChange={onToggleSelect}
            aria-label={`${room.number} tanlash`}
            className="h-4 w-4 rounded border-zinc-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
          />
          <Button
            type="button"
            variant="ghost"
            onClick={onEdit}
            className="text-2xl font-bold text-zinc-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-400 transition-colors text-left truncate p-0 h-auto hover:bg-transparent justify-start"
            title="Tahrirlash"
          >
            {room.number}
          </Button>
          {!room.isListed && (
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400 shrink-0">
              YASHIRILGAN
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onEdit}
            className="h-8 w-8 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            title="Tahrirlash"
            aria-label="Tahrirlash"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={onDelete}
            className="h-8 w-8 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 dark:text-red-400"
            title="O'chirish"
            aria-label="O'chirish"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Housekeeping / Tozalik holati boshqaruvi */}
      <div className="mt-3">
        {isBus ? (
          <div className="flex items-center justify-between">
            <span className={cn(
              "text-[11px] font-medium px-2 py-0.5 rounded-full",
              room.status === RoomStatus.OUT_OF_SERVICE ? 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
            )}>
              {room.status === RoomStatus.OUT_OF_SERVICE ? 'Faol emas' : 'Faol'}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleToggleBusStatus}
              disabled={isUpdating}
              loading={isUpdating}
              className={cn(
                "h-6 px-2 py-0 text-[11px] font-medium",
                room.status === RoomStatus.OUT_OF_SERVICE
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
              )}
            >
              {room.status === RoomStatus.OUT_OF_SERVICE ? 'Faollashtirish' : "O'chirish"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">
              Holat
            </label>
            <select
              aria-label="Xona holati"
              value={room.status}
              disabled={isUpdating}
              onChange={(e) => handleStatusChange(e.target.value as RoomStatus)}
              className={cn(
                "w-full cursor-pointer rounded-lg border px-2.5 py-1 text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20",
                room.status === RoomStatus.VACANT_CLEAN && "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300",
                room.status === RoomStatus.VACANT_DIRTY && "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/40 dark:text-amber-300",
                room.status === RoomStatus.OCCUPIED && "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-800/40 dark:bg-blue-950/40 dark:text-blue-300",
                room.status === RoomStatus.OUT_OF_SERVICE && "border-red-200 bg-red-50 text-red-800 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-300",
                room.status === RoomStatus.BLOCKED && "border-zinc-300 bg-zinc-100 text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              )}
            >
              <option value={RoomStatus.VACANT_CLEAN}>✓ Bo'sh & Tayyor (Toza)</option>
              <option value={RoomStatus.VACANT_DIRTY}>🧹 Tozalanmoqda (Notoza)</option>
              <option value={RoomStatus.OCCUPIED}>👤 Band (Mehmon bor)</option>
              <option value={RoomStatus.OUT_OF_SERVICE}>🔧 Ta'mirda</option>
              <option value={RoomStatus.BLOCKED}>🚫 Bloklangan</option>
            </select>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-col gap-1.5">
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

      <div className="mt-4 flex items-center justify-between gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800/80">
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

        <div className="flex items-center gap-2 ml-auto">
          {beds && onManageBeds && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onManageBeds();
              }}
              className="h-7 px-2 py-0 text-[11px] font-medium gap-1 text-zinc-600 dark:text-zinc-300"
            >
              <BedSingle className="h-3 w-3" aria-hidden />
              {freeBeds}/{beds.length} bo'sh
            </Button>
          )}
        </div>
      </div>

      <div className="mt-auto pt-3 flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800">
        <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
          Sotuvda ko'rsatish
        </span>
        <label className="relative inline-flex items-center cursor-pointer">
          <input 
            type="checkbox" 
            className="sr-only peer" 
            checked={room.isListed}
            disabled={isUpdating}
            onChange={(e) => {
              updateRoom(
                {
                  id: room.id,
                  values: {
                    isListed: e.target.checked,
                  },
                },
                {
                  onSuccess: () => {
                    toast.success(e.target.checked ? `${room.number} sotuvga chiqarildi` : `${room.number} sotuvdan yashirildi`);
                  },
                }
              );
            }}
          />
          <div className="w-9 h-5 bg-zinc-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-brand-500/30 rounded-full peer dark:bg-zinc-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-zinc-600 peer-checked:bg-brand-600 peer-disabled:opacity-50 peer-disabled:cursor-not-allowed"></div>
        </label>
      </div>
    </div>
  );
}

