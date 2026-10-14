"use client";

import { CarFront } from "lucide-react";
import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { PageHeader } from "../../_components/layout/page-header";
import {
  useVehicles,
  useUpdateVehicle,
  vehiclesQueryKey,
} from "../../_hooks/use-vehicles";
import { Button } from "../../_components/ui/button";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels } from "../../_lib/utils/partner-labels";
import { EmptyState, LoadingState, ErrorState } from "../../_components/ui/empty-state";
import { useConfirm } from "../../_components/ui/confirm-dialog";
import { partners, request } from "../../_lib/api";

import { VehicleCard, formatPlateDisplay } from "./vehicle-card";
import { VehiclesStats } from "./vehicles-stats";
import { VehiclesFilters } from "./vehicles-filters";
import { VehicleDialog } from "./vehicle-dialog";
import type {
  Vehicle,
  VehicleSortOption,
  VehicleStatusFilter,
  VehicleMetrics,
} from "./vehicles-types";

export { VehicleDialog } from "./vehicle-dialog";
export { VehicleCard, formatPlateDisplay } from "./vehicle-card";
export { VehiclesStats } from "./vehicles-stats";
export { VehiclesFilters } from "./vehicles-filters";
export * from "./vehicles-types";

export function VehiclesView() {
  const { data: rawVehicles = [], isLoading, isError, refetch } = useVehicles();
  const updateVehicle = useUpdateVehicle();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const queryClient = useQueryClient();
  const labels = getPartnerLabels(partnerType);
  const confirm = useConfirm();

  const [addingVehicle, setAddingVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<VehicleStatusFilter>("all");
  const [sortBy, setSortBy] = useState<VehicleSortOption>("name");

  // Format vehicles list safely
  const vehicles: Vehicle[] = useMemo(() => {
    return (rawVehicles as any[]).map((v) => ({
      id: String(v.id),
      name: String(v.name || ""),
      plateNumber: v.plateNumber || null,
      seatsCount: Number(v.seatsCount) || 4,
      pricePerDay: Number(v.pricePerDay) || 0,
      status: v.status === "inactive" ? "inactive" : "active",
    }));
  }, [rawVehicles]);

  // Operational KPI metrics
  const metrics: VehicleMetrics = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter((v) => v.status === "active").length;
    const inactive = vehicles.filter((v) => v.status === "inactive").length;
    const activeRate = total > 0 ? Math.round((active / total) * 100) : 0;
    return { total, active, inactive, activeRate };
  }, [vehicles]);

  // Filtered & searched vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = v.name.toLowerCase().includes(q);
        const matchesPlate = v.plateNumber
          ? v.plateNumber.toLowerCase().includes(q)
          : false;
        if (!matchesName && !matchesPlate) return false;
      }
      return true;
    });
  }, [vehicles, statusFilter, searchQuery]);

  // Sorted vehicles
  const sortedVehicles = useMemo(() => {
    return [...filteredVehicles].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      }
      if (sortBy === "price_asc") {
        return a.pricePerDay - b.pricePerDay;
      }
      if (sortBy === "price_desc") {
        return b.pricePerDay - a.pricePerDay;
      }
      if (sortBy === "seats_desc") {
        return b.seatsCount - a.seatsCount;
      }
      if (sortBy === "status") {
        if (a.status === b.status) return a.name.localeCompare(b.name);
        return a.status === "active" ? -1 : 1;
      }
      return 0;
    });
  }, [filteredVehicles, sortBy]);

  // Instant optimistic status toggle
  const handleToggleStatus = async (vehicle: Vehicle) => {
    const nextStatus = vehicle.status === "active" ? "inactive" : "active";
    try {
      await updateVehicle.mutateAsync({
        id: vehicle.id,
        values: { status: nextStatus },
      });
      toast.success(
        nextStatus === "active"
          ? `${vehicle.name} sotuvga chiqarildi`
          : `${vehicle.name} sotuvdan yashirildi`
      );
    } catch (e: any) {
      toast.error(
        e?.response?.data?.message ||
          e?.message ||
          "Holatni o'zgartirishda xatolik yuz berdi"
      );
      throw e;
    }
  };

  // Safe delete with useConfirm() and backend fallback
  const handleDeleteVehicle = async (vehicle: Vehicle) => {
    const ok = await confirm({
      title: `${vehicle.name}ni o'chirish`,
      description: `Rostdan ham ushbu ${vehicle.name} (${formatPlateDisplay(
        vehicle.plateNumber
      )}) avtomobilini o'chirmoqchimisiz? Bu amalni bekor qilib bo'lmaydi.`,
      confirmText: "O'chirish",
      cancelText: "Bekor qilish",
      destructive: true,
    });

    if (!ok) return;

    try {
      try {
        await request<{ ok?: boolean }>(`/partners/vehicles/${vehicle.id}`, {
          method: "DELETE",
          token: accessToken,
        });
      } catch (err: any) {
        // Fallback: Agar backend DELETE endpointini taqdim qilmagan bo'lsa, nofaol qilish
        if (err?.status === 404 || err?.status === 405) {
          await partners.updateVehicle(
            vehicle.id,
            { status: "inactive" },
            accessToken
          );
        } else {
          throw err;
        }
      }

      await queryClient.invalidateQueries({ queryKey: vehiclesQueryKey });
      toast.success(`${vehicle.name} muvaffaqiyatli o'chirildi`);
    } catch (err: any) {
      toast.error(
        err?.response?.data?.message ||
          err?.message ||
          "Avtomobilni o'chirishda xatolik yuz berdi"
      );
    }
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setStatusFilter("all");
    setSortBy("name");
  };

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-12">
      {/* Sahifa sarlavhasi va Yangi avtomobil qo'shish tugmasi */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <PageHeader
          eyebrow="Operatsion"
          title={labels.unitsPageTitle}
          description={labels.unitsPageDescription}
        />
        <div className="sm:mt-0">
          <Button
            onClick={() => setAddingVehicle(true)}
            className="gap-2 font-semibold shadow-sm"
          >
            <CarFront className="h-4 w-4" aria-hidden="true" />
            <span>{labels.addUnitLabel}</span>
          </Button>
        </div>
      </div>

      {/* KPI Ko'rsatkichlar kartalari */}
      {vehicles.length > 0 && (
        <VehiclesStats
          metrics={metrics}
          selectedStatus={statusFilter}
          onSelectStatus={setStatusFilter}
        />
      )}

      {/* Qidiruv va Filtrlar paneli */}
      {vehicles.length > 0 && (
        <VehiclesFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedStatus={statusFilter}
          onStatusChange={setStatusFilter}
          sortBy={sortBy}
          onSortChange={setSortBy}
          onResetFilters={handleResetFilters}
          activeCount={metrics.active}
          inactiveCount={metrics.inactive}
        />
      )}

      {/* Asosiy kontent / Holatlar */}
      <div className="flex flex-col gap-6">
        {isLoading ? (
          <LoadingState
            title="Avtomobillar ro'yxati yuklanmoqda..."
            description="Tizimdagi barcha transport vositalari olinmoqda"
          />
        ) : isError ? (
          <ErrorState
            title="Avtomobillarni yuklashda xatolik yuz berdi"
            description="Tarmoq aloqasini tekshiring yoki qayta urinib ko'ring."
            action={
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Qayta urinish
              </Button>
            }
          />
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon={<CarFront className="h-10 w-10 text-brand-500" />}
            title="Hali hech qanday avtomobil qo'shilmagan"
            description="Parkdagi avtomobillaringizni qo'shing va ularni buyurtmalar uchun sotuvga chiqaring."
            action={
              <Button onClick={() => setAddingVehicle(true)} className="gap-2">
                <CarFront className="h-4 w-4" />
                {labels.addUnitLabel}
              </Button>
            }
          />
        ) : sortedVehicles.length === 0 ? (
          <EmptyState
            title="Qidiruv natijasida avtomobil topilmadi"
            description="Qidiruv so'zini o'zgartiring yoki filtrlarni tozalang."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetFilters}
              >
                Filtrlarni tozalash
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedVehicles.map((vehicle) => (
              <VehicleCard
                key={vehicle.id}
                vehicle={vehicle}
                onEdit={setEditingVehicle}
                onDelete={handleDeleteVehicle}
                onToggleStatus={handleToggleStatus}
              />
            ))}
          </div>
        )}
      </div>

      {/* Avtomobil qo'shish va tahrirlash dialogi */}
      <VehicleDialog
        open={addingVehicle || Boolean(editingVehicle)}
        onClose={() => {
          setAddingVehicle(false);
          setEditingVehicle(null);
        }}
        editing={editingVehicle}
      />
    </div>
  );
}

export default VehiclesView;
