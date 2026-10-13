"use client";

import { CarFront, Pencil, Search } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { PageHeader } from "../../_components/layout/page-header";
import { useVehicles, useCreateVehicle, useUpdateVehicle } from "../../_hooks/use-vehicles";
import { Button } from "../../_components/ui/button";
import { formatMoney } from "../../_lib/utils/format";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels } from "../../_lib/utils/partner-labels";
import { Dialog } from "../../_components/ui/dialog";
import { EmptyState, LoadingState, ErrorState } from "../../_components/ui/empty-state";
import { Input } from "../../_components/ui/input";
import { PlateInput } from "../../_components/ui/plate-input";
import { MoneyInput } from "../../_components/ui/money-input";
import { Label } from "../../_components/ui/label";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { cn } from "../../_lib/utils/cn";

const schema = z.object({
  name: z.string().min(1, "Avtomobil rusumini kiriting (masalan, Cobalt)"),
  plateNumber: z.string().min(4, "Davlat raqamini kiriting (masalan, 01 A 777 AA)"),
  seatsCount: z.number().int().min(1, "O'rindiqlar soni kamida 1 bo'lishi kerak").max(50),
  pricePerDay: z.number().int().min(0, "Narxni to'g'ri kiriting"),
});

type Values = z.infer<typeof schema>;

export function VehiclesView() {
  const { data: vehicles = [], isLoading, isError, refetch } = useVehicles();
  const updateVehicle = useUpdateVehicle();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);

  const [addingVehicle, setAddingVehicle] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const metrics = useMemo(() => {
    const total = vehicles.length;
    const active = vehicles.filter((v) => v.status === "active").length;
    const inactive = vehicles.filter((v) => v.status === "inactive").length;
    return { total, active, inactive };
  }, [vehicles]);

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      if (statusFilter !== "all" && v.status !== statusFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesName = v.name?.toLowerCase().includes(q);
        const matchesPlate = v.plateNumber?.toLowerCase().includes(q);
        if (!matchesName && !matchesPlate) return false;
      }
      return true;
    });
  }, [vehicles, statusFilter, searchQuery]);

  return (
    <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Operatsion"
          title={labels.unitsPageTitle}
          description={labels.unitsPageDescription}
        />
        <div className="mt-4 sm:mt-0">
          <Button onClick={() => setAddingVehicle(true)}>
            <CarFront className="mr-2 h-4 w-4" />
            {labels.addUnitLabel}
          </Button>
        </div>
      </div>

      {/* KPI Ko'rsatkichlar */}
      {vehicles.length > 0 && (
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => setStatusFilter("all")}
            className={cn(
              "flex flex-col rounded-xl border p-4 text-left transition-all",
              statusFilter === "all"
                ? "border-brand-500 bg-brand-50/50 shadow-sm dark:border-brand-600 dark:bg-brand-950/20"
                : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50"
            )}
          >
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Jami avtomobillar</span>
            <span className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">{metrics.total} ta</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
            className={cn(
              "flex flex-col rounded-xl border p-4 text-left transition-all",
              statusFilter === "active"
                ? "border-emerald-500 bg-emerald-50/50 shadow-sm dark:border-emerald-600 dark:bg-emerald-950/20"
                : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50"
            )}
          >
            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">Faol (Sotuvda)</span>
            <span className="mt-1 text-2xl font-bold text-emerald-700 dark:text-emerald-400">{metrics.active} ta</span>
          </button>

          <button
            type="button"
            onClick={() => setStatusFilter(statusFilter === "inactive" ? "all" : "inactive")}
            className={cn(
              "flex flex-col rounded-xl border p-4 text-left transition-all",
              statusFilter === "inactive"
                ? "border-amber-500 bg-amber-50/50 shadow-sm dark:border-amber-600 dark:bg-amber-950/20"
                : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900/50"
            )}
          >
            <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">Nofaol (Yopiq)</span>
            <span className="mt-1 text-2xl font-bold text-zinc-700 dark:text-zinc-300">{metrics.inactive} ta</span>
          </button>
        </section>
      )}

      {/* Filter & Qidiruv paneli */}
      {vehicles.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-[var(--surface-muted)]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rusumi yoki davlat raqami..."
              className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50 pl-9 pr-3 text-sm focus:border-brand-500 focus:bg-white focus:outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:focus:bg-zinc-800"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              aria-label="Holat filtri"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="h-9 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium focus:border-brand-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="all">Barcha holatlar</option>
              <option value="active">Faqat faol</option>
              <option value="inactive">Faqat nofaol</option>
            </select>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {isLoading ? (
          <LoadingState title="Avtomobillar yuklanmoqda..." />
        ) : isError ? (
          <ErrorState 
            title="Avtomobillarni yuklashda xatolik yuz berdi" 
            action={<Button onClick={() => refetch()} variant="outline" size="sm">Qayta urinish</Button>} 
          />
        ) : vehicles.length === 0 ? (
          <EmptyState
            icon={<CarFront className="h-8 w-8" />}
            title="Hali hech qanday avtomobil qo'shilmagan"
            description="Avtomobil qo'shish tugmasini bosib birinchi avtomobilingizni yarating."
            action={
              <Button onClick={() => setAddingVehicle(true)}>
                <CarFront className="mr-2 h-4 w-4" />
                {labels.addUnitLabel}
              </Button>
            }
          />
        ) : filteredVehicles.length === 0 ? (
          <EmptyState
            title="Qidiruv natijasida avtomobil topilmadi"
            description="Qidiruv so'zini o'zgartiring yoki filtrlarni tozalang."
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                }}
              >
                Filtrlarni tozalash
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVehicles.map((vehicle) => (
              <div key={vehicle.id} className={`relative flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/50 group transition-all duration-200 ${vehicle.status === 'inactive' ? 'opacity-50 bg-zinc-50 dark:bg-zinc-900/50 grayscale-[50%]' : ''}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-lg text-zinc-900 dark:text-white">{vehicle.name}</h3>
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        vehicle.status === 'active' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      )}>
                        {vehicle.status === 'active' ? 'Faol' : 'Nofaol'}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-zinc-500 mt-1 uppercase tracking-wider">{vehicle.plateNumber}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => setEditingVehicle(vehicle)}>
                    <Pencil className="h-4 w-4 text-zinc-500" />
                  </Button>
                </div>
                
                <div className="flex flex-col gap-1 mt-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">O'rindiqlar soni:</span>
                    <span className="font-medium">{vehicle.seatsCount} kishi</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-500">Kunlik narxi:</span>
                    <span className="font-medium text-brand-600 dark:text-brand-400">{formatMoney(vehicle.pricePerDay)}</span>
                  </div>
                </div>

                <div className="mt-3 border-t border-zinc-100 dark:border-zinc-800 pt-3">
                  <Button 
                    variant={vehicle.status === 'active' ? 'outline' : 'secondary'} 
                    size="sm" 
                    className="w-full"
                    onClick={async () => {
                      const newStatus = vehicle.status === 'active' ? 'inactive' : 'active';
                      try {
                        await updateVehicle.mutateAsync({
                          id: vehicle.id,
                          values: { status: newStatus },
                        });
                        toast.success("Holati o'zgartirildi");
                      } catch {
                        toast.error("Xatolik yuz berdi");
                      }
                    }}
                  >
                    {vehicle.status === 'active' ? "E'londan olish" : "E'longa chiqarish"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <VehicleDialog
        open={addingVehicle || !!editingVehicle}
        onClose={() => { setAddingVehicle(false); setEditingVehicle(null); }}
        editing={editingVehicle}
      />
    </div>
  );
}

export function VehicleDialog({ open, onClose, editing }: { open: boolean, onClose: () => void, editing: any }) {
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();
  
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      plateNumber: "",
      seatsCount: 4,
      pricePerDay: 300000,
    },
  });

  useEffect(() => {
    if (open) {
      if (editing) {
        form.reset({
          name: editing.name,
          plateNumber: editing.plateNumber || "",
          seatsCount: editing.seatsCount,
          pricePerDay: editing.pricePerDay,
        });
      } else {
        form.reset({ name: "", plateNumber: "", seatsCount: 4, pricePerDay: 300000 });
      }
    }
  }, [open, editing, form]);

  const onSubmit = async (values: Values) => {
    try {
      if (editing) {
        await updateVehicle.mutateAsync({
          id: editing.id,
          values: { ...values, status: editing.status },
        });
        toast.success("Avtomobil yangilandi");
      } else {
        await createVehicle.mutateAsync({ ...values, status: "active" });
        toast.success("Avtomobil qo'shildi");
      }
      onClose();
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Xatolik yuz berdi");
    }
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      title={editing ? "Avtomobilni tahrirlash" : "Yangi avtomobil qo'shish"}
      description="Avtomobil rusumi, davlat raqami va kunlik narxini kiriting."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>Bekor qilish</Button>
          <Button type="submit" form="vehicle-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </>
      }
    >
      <form id="vehicle-form" onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-4 py-2">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1.5 col-span-2">
            <Label>Avtomobil rusumi</Label>
            <Input placeholder="masalan: Chevrolet Cobalt" {...form.register("name")} />
            {form.formState.errors.name && <span className="text-xs text-red-500">{form.formState.errors.name.message}</span>}
          </div>
          
          <div className="flex flex-col gap-1.5">
            <Label>Davlat raqami</Label>
            <PlateInput placeholder="01 A 777 AA" {...form.register("plateNumber")} />
            {form.formState.errors.plateNumber && <span className="text-xs text-red-500">{form.formState.errors.plateNumber.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>O'rindiqlar soni</Label>
            <Input type="number" {...form.register("seatsCount", { valueAsNumber: true })} />
            {form.formState.errors.seatsCount && <span className="text-xs text-red-500">{form.formState.errors.seatsCount.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5 col-span-2">
            <Label>Kunlik narxi (so'm)</Label>
            <MoneyInput {...form.register("pricePerDay", { valueAsNumber: true })} />
            {form.formState.errors.pricePerDay && <span className="text-xs text-red-500">{form.formState.errors.pricePerDay.message}</span>}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
