"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BedDouble, CarFront, UtensilsCrossed } from "lucide-react";

import { useBeds } from "../../_hooks/use-beds";
import { useRooms, useUpdateRoom, useDeleteRoom } from "../../_hooks/use-rooms";
import { useRoomTypes } from "../../_hooks/use-room-types";
import { RoomStatus, type Room } from "../../_lib/domain/types";
import { useConfirm } from "../../_components/ui/confirm-dialog";
import { BulkActionBar } from "../../_components/domain/bulk-action-bar";
import { EmptyState, LoadingState, ErrorState } from "../../_components/ui/empty-state";
import { Button } from "../../_components/ui/button";
import { useAuthStore } from "../../_stores/auth-store";
import {
  getPartnerLabels,
  hasBeds,
  hasBuses,
  isDacha,
  isRestaurant,
} from "../../_lib/utils/partner-labels";

import { ROOM_STATUS_OPTIONS, type RoomMetrics, type RoomSortOption, type RoomViewMode } from "./types";
import { RoomsHeader } from "./rooms-header";
import { RoomsStats } from "./rooms-stats";
import { RoomsFilters } from "./rooms-filters";
import { RoomsFloorSection } from "./rooms-floor-section";
import { RoomsTable } from "./rooms-table";
import { AddRoomDialog } from "./_dialogs/add-room-dialog";
import { EditRoomDialog } from "./_dialogs/edit-room-dialog";
import { BedManagementDialog } from "./_dialogs/bed-management-dialog";

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

  // Modallar holati
  const [addingRoom, setAddingRoom] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  const [managingBedsFor, setManagingBedsFor] = useState<Room | null>(null);
  const [updatingRoomId, setUpdatingRoomId] = useState<string | null>(null);

  // Tanlov va guruhli amallar holati
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Qidiruv va filtrlar holati
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFloor, setSelectedFloor] = useState<number | "all">("all");
  const [selectedType, setSelectedType] = useState<string | "all">("all");
  const [selectedStatus, setSelectedStatus] = useState<RoomStatus | "all">("all");
  const [sortBy, setSortBy] = useState<RoomSortOption>("number");
  const [viewMode, setViewMode] = useState<RoomViewMode>("grid");

  // Dacha bo'lsa yo'naltirish
  useEffect(() => {
    if (isDachaType) router.replace("/listing");
  }, [isDachaType, router]);

  // Faol xonalar ro'yxati
  const validRooms = useMemo(() => {
    return rooms.filter((room) => !room.number.startsWith("DELETED_"));
  }, [rooms]);

  // Operatsion KPI ko'rsatkichlar
  const metrics: RoomMetrics = useMemo(() => {
    const total = validRooms.length;
    const clean = validRooms.filter((r) => r.status === RoomStatus.VACANT_CLEAN).length;
    const dirty = validRooms.filter((r) => r.status === RoomStatus.VACANT_DIRTY).length;
    const occupied = validRooms.filter((r) => r.status === RoomStatus.OCCUPIED).length;
    const outOfService = validRooms.filter((r) => r.status === RoomStatus.OUT_OF_SERVICE).length;
    const blocked = validRooms.filter((r) => r.status === RoomStatus.BLOCKED).length;
    const occupancyRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
    return { total, clean, dirty, occupied, outOfService, blocked, occupancyRate };
  }, [validRooms]);

  // Mavjud qavatlar ro'yxati
  const availableFloors = useMemo(() => {
    const set = new Set<number>();
    validRooms.forEach((r) => set.add(r.floor));
    return Array.from(set).sort((a, b) => a - b);
  }, [validRooms]);

  // Filtrlangan va saralangan xonalar
  const filteredRooms = useMemo(() => {
    const filtered = validRooms.filter((room) => {
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

    return [...filtered].sort((a, b) => {
      if (sortBy === "status") {
        return a.status.localeCompare(b.status);
      }
      return a.number.localeCompare(b.number, undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });
  }, [validRooms, selectedFloor, selectedType, selectedStatus, searchQuery, sortBy]);

  // Qavatlar bo'yicha guruhlangan xonalar
  const floors = useMemo(() => {
    const map = new Map<number, Room[]>();
    filteredRooms.forEach((room) => {
      if (!map.has(room.floor)) {
        map.set(room.floor, []);
      }
      map.get(room.floor)!.push(room);
    });

    return Array.from(map.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([floor, floorRooms]) => ({
        floor,
        rooms: floorRooms,
      }));
  }, [filteredRooms]);

  // Tanlov amallari
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

  const handleToggleFloor = (floor: number, roomIds: string[]) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      const allSelected = roomIds.every((id) => next.has(id));
      if (allSelected) {
        roomIds.forEach((id) => next.delete(id));
      } else {
        roomIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleToggleSelectAllVisible = () => {
    setSelectedRoomIds((prev) => {
      const visibleIds = filteredRooms.map((r) => r.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        return new Set();
      }
      return new Set(visibleIds);
    });
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedFloor("all");
    setSelectedType("all");
    setSelectedStatus("all");
    setSortBy("number");
  };

  // Yakka xona amallari
  const handleDeleteRoom = async (room: Room) => {
    const ok = await confirm({
      title: `${room.number} raqamli ${labels.unitSingular.toLowerCase()}ni o'chirish`,
      description: `Rostdan ham ${room.number} raqamli ${labels.unitSingular.toLowerCase()}ni o'chirmoqchimisiz? Bu amalni bekor qilib bo'lmaydi.`,
      confirmText: "O'chirish",
      cancelText: "Bekor qilish",
      destructive: true,
    });
    if (!ok) return;

    deleteRoom(room.id, {
      onSuccess: () => {
        toast.success(
          `${room.number} raqamli ${labels.unitSingular.toLowerCase()} muvaffaqiyatli o'chirildi`
        );
        setSelectedRoomIds((prev) => {
          if (!prev.has(room.id)) return prev;
          const next = new Set(prev);
          next.delete(room.id);
          return next;
        });
      },
      onError: (err: any) => {
        toast.error(err?.payload?.message || err?.message || "O'chirishda xatolik yuz berdi");
      },
    });
  };

  const handleStatusChange = async (room: Room, status: RoomStatus) => {
    setUpdatingRoomId(room.id);
    try {
      await updateRoomAsync({
        id: room.id,
        values: {
          number: room.number,
          floor: room.floor,
          roomTypeId: room.roomTypeId,
          status,
          isListed: room.isListed,
        },
      });
      toast.success(`${room.number} xona holati yangilandi`);
    } catch (err: any) {
      toast.error(err?.payload?.message || err?.message || "Holatni yangilashda xatolik yuz berdi");
    } finally {
      setUpdatingRoomId(null);
    }
  };

  const handleToggleListed = async (room: Room) => {
    setUpdatingRoomId(room.id);
    try {
      await updateRoomAsync({
        id: room.id,
        values: {
          number: room.number,
          floor: room.floor,
          roomTypeId: room.roomTypeId,
          status: room.status,
          isListed: !room.isListed,
        },
      });
      toast.success(
        room.isListed
          ? `${room.number} sotuvdan yashirildi`
          : `${room.number} sotuvga chiqarildi`
      );
    } catch (err: any) {
      toast.error(err?.payload?.message || err?.message || "Xatolik yuz berdi");
    } finally {
      setUpdatingRoomId(null);
    }
  };

  const handleToggleBusStatus = async (room: Room) => {
    setUpdatingRoomId(room.id);
    const newStatus =
      room.status === RoomStatus.OUT_OF_SERVICE
        ? RoomStatus.VACANT_CLEAN
        : RoomStatus.OUT_OF_SERVICE;
    try {
      await updateRoomAsync({
        id: room.id,
        values: {
          number: room.number,
          floor: room.floor,
          roomTypeId: room.roomTypeId,
          status: newStatus,
          isListed: room.isListed,
        },
      });
      toast.success(
        newStatus === RoomStatus.OUT_OF_SERVICE
          ? `${room.number} o'chirildi`
          : `${room.number} faollashtirildi`
      );
    } catch (err: any) {
      toast.error(err?.payload?.message || err?.message || "Xatolik yuz berdi");
    } finally {
      setUpdatingRoomId(null);
    }
  };

  // Guruhli amallar (Bulk actions)
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
        })
      );
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected").length;

      if (rejected === 0) {
        toast.success(`${fulfilled} ta ${labels.unitSingular.toLowerCase()} holati yangilandi`);
        setSelectedRoomIds(new Set());
      } else {
        toast.warning(`${fulfilled} ta muvaffaqiyatli, ${rejected} tasida xatolik yuz berdi`);
        const failedIds = new Set(
          ids.filter((_, idx) => results[idx].status === "rejected")
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
        })
      );
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected").length;

      if (rejected === 0) {
        toast.success(
          `${fulfilled} ta ${labels.unitSingular.toLowerCase()} toza holatga o'tkazildi`
        );
        setSelectedRoomIds(new Set());
      } else {
        toast.warning(`${fulfilled} ta muvaffaqiyatli, ${rejected} tasida xatolik yuz berdi`);
        const failedIds = new Set(
          ids.filter((_, idx) => results[idx].status === "rejected")
        );
        setSelectedRoomIds(failedIds);
      }
      refetch();
    } catch {
      toast.error("Ommaviy tasdiqlashda xatolik yuz berdi");
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
        })
      );
      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected").length;

      if (rejected === 0) {
        toast.success(`${fulfilled} ta ${labels.unitSingular.toLowerCase()} ta'mirga olindi`);
        setSelectedRoomIds(new Set());
      } else {
        toast.warning(`${fulfilled} ta muvaffaqiyatli, ${rejected} tasida xatolik yuz berdi`);
        const failedIds = new Set(
          ids.filter((_, idx) => results[idx].status === "rejected")
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

  if (isDachaType) return null;

  const EmptyIcon = isBus ? CarFront : restaurant ? UtensilsCrossed : BedDouble;

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-14">
      {/* Sarlavha va Ko'rinish rejimi boshqaruvi */}
      <RoomsHeader
        title={labels.unitsPageTitle}
        description={labels.unitsPageDescription}
        addLabel={labels.addUnitLabel}
        isBus={isBus}
        restaurant={restaurant}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onAddRoom={() => setAddingRoom(true)}
        totalRooms={validRooms.length}
      />

      {/* Operatsion statistika paneli */}
      {validRooms.length > 0 && (
        <RoomsStats
          metrics={metrics}
          selectedStatus={selectedStatus}
          onSelectStatus={setSelectedStatus}
          unitPlural={labels.unitPlural}
          isBus={isBus}
        />
      )}

      {/* Filtrlash va qidiruv boshqaruv paneli */}
      {validRooms.length > 0 && (
        <RoomsFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedFloor={selectedFloor}
          onFloorChange={setSelectedFloor}
          availableFloors={availableFloors}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          roomTypes={roomTypes}
          selectedStatus={selectedStatus}
          onStatusChange={setSelectedStatus}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onResetFilters={handleResetFilters}
          unitSingular={labels.unitSingular}
          floorSingular={labels.floorSingular}
          isBus={isBus}
        />
      )}

      {/* Asosiy kontent maydoni */}
      <div className="flex flex-col gap-8">
        {isLoading ? (
          <LoadingState title={`${labels.unitPlural} yuklanmoqda...`} />
        ) : isError ? (
          <ErrorState
            title={`${labels.unitPlural}ni yuklashda xatolik yuz berdi`}
            action={
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Qayta urinish
              </Button>
            }
          />
        ) : validRooms.length === 0 ? (
          <EmptyState
            icon={<EmptyIcon className="h-8 w-8" />}
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
              <Button variant="outline" size="sm" onClick={handleResetFilters}>
                Filtrlarni tozalash
              </Button>
            }
          />
        ) : viewMode === "table" ? (
          <RoomsTable
            rooms={filteredRooms}
            roomTypes={roomTypes}
            beds={beds}
            isHostel={isHostel}
            restaurant={restaurant}
            isBus={isBus}
            labels={labels}
            selectedRoomIds={selectedRoomIds}
            onToggleRoom={handleToggleRoom}
            onToggleSelectAllVisible={handleToggleSelectAllVisible}
            onEditRoom={setEditingRoom}
            onDeleteRoom={handleDeleteRoom}
            onManageBeds={setManagingBedsFor}
            onStatusChange={handleStatusChange}
            onToggleListed={handleToggleListed}
            onToggleBusStatus={isBus ? handleToggleBusStatus : undefined}
            updatingRoomId={updatingRoomId}
          />
        ) : (
          floors.map(({ floor, rooms: floorRooms }) => (
            <RoomsFloorSection
              key={floor}
              floor={floor}
              rooms={floorRooms}
              roomTypes={roomTypes}
              beds={beds}
              isHostel={isHostel}
              restaurant={restaurant}
              isBus={isBus}
              labels={labels}
              selectedRoomIds={selectedRoomIds}
              onToggleRoom={handleToggleRoom}
              onToggleFloor={handleToggleFloor}
              onEditRoom={setEditingRoom}
              onDeleteRoom={handleDeleteRoom}
              onManageBeds={setManagingBedsFor}
              onStatusChange={handleStatusChange}
              onToggleListed={handleToggleListed}
              onToggleBusStatus={isBus ? handleToggleBusStatus : undefined}
              updatingRoomId={updatingRoomId}
            />
          ))
        )}
      </div>

      {/* Dialoglar */}
      <AddRoomDialog
        open={addingRoom}
        onClose={() => setAddingRoom(false)}
      />

      <EditRoomDialog
        open={Boolean(editingRoom)}
        onClose={() => setEditingRoom(null)}
        room={editingRoom}
      />

      <BedManagementDialog
        open={Boolean(managingBedsFor)}
        onClose={() => setManagingBedsFor(null)}
        room={managingBedsFor}
      />

      {/* Suzuvchi guruhli amallar paneli */}
      <BulkActionBar
        selectedCount={selectedRoomIds.size}
        onClear={handleClearSelection}
        entityName={`${labels.unitSingular.toLowerCase()} tanlandi`}
        onConfirmAll={handleBulkConfirmAll}
        onCancelAll={handleBulkCancelAll}
        onChangeStatus={handleBulkStatusChange}
        statusOptions={ROOM_STATUS_OPTIONS}
        isProcessing={isBulkProcessing}
      />
    </div>
  );
}
