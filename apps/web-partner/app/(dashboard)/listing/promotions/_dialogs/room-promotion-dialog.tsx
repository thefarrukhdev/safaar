"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Dialog } from "../../../../_components/ui/dialog";
import { Button } from "../../../../_components/ui/button";
import { Input } from "../../../../_components/ui/input";
import { Label } from "../../../../_components/ui/label";

import { promotions } from "../../../../_lib/api/endpoints/promotions";
import { useRooms } from "../../../../_hooks/use-rooms";
import { useVehicles } from "../../../../_hooks/use-vehicles";
import { useAuthStore } from "../../../../_stores/auth-store";
import { hasBuses } from "../../../../_lib/utils/partner-labels";

const schema = z.object({
  entityId: z.string().min(1, "Obyektni tanlang"),
  oldPriceSum: z.number().min(1000, "Kamida 1000 so'm bo'lishi kerak"),
  newPriceSum: z.number().min(1000, "Kamida 1000 so'm bo'lishi kerak"),
  discountPercent: z.number().min(1, "Kamida 1% bo'lishi kerak").max(99, "Maksimum 99%"),
  startDate: z.string().min(1, "Boshlanish sanasini kiriting"),
  endDate: z.string().min(1, "Tugash sanasini kiriting"),
}).refine(data => data.newPriceSum < data.oldPriceSum, {
  message: "Yangi narx eski narxdan kichik bo'lishi kerak",
  path: ["newPriceSum"],
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function RoomPromotionDialog({ open, onClose, onSuccess }: Props) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const isBus = hasBuses(partnerType);

  const { data: rooms = [] } = useRooms();
  const { data: vehicles = [] } = useVehicles();

  const activeOptions = useMemo(() => {
    if (isBus) {
      return vehicles
        .filter(v => v.status === "active")
        .map(v => ({ id: v.id, label: `${v.plateNumber} (${v.name})`, type: "vehicle" as const, price: v.pricePerDay || 0 }));
    } else {
      return rooms
        .filter(r => (r as any)._rawStatus === "active" && !r.number.startsWith("DELETED_"))
        .map(r => ({ id: r.id, label: `Xona: ${r.number}`, type: "room" as const, price: r.nightlyPrice || 0 }));
    }
  }, [rooms, vehicles, isBus]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      entityId: "",
      oldPriceSum: 0,
      newPriceSum: 0,
      discountPercent: 10,
      startDate: "",
      endDate: "",
    }
  });

  const selectedEntityId = form.watch("entityId");
  const oldPriceSum = form.watch("oldPriceSum");
  const newPriceSum = form.watch("newPriceSum");

  useEffect(() => {
    if (selectedEntityId) {
      const option = activeOptions.find(o => o.id === selectedEntityId);
      if (option && option.price > 0 && form.getValues("oldPriceSum") === 0) {
        form.setValue("oldPriceSum", option.price, { shouldValidate: true });
      }
    }
  }, [selectedEntityId, activeOptions, form]);

  useEffect(() => {
    if (oldPriceSum > 0 && newPriceSum > 0 && newPriceSum < oldPriceSum) {
      const diff = oldPriceSum - newPriceSum;
      const percent = Math.round((diff / oldPriceSum) * 100);
      form.setValue("discountPercent", percent, { shouldValidate: true });
    }
  }, [oldPriceSum, newPriceSum, form]);

  useEffect(() => {
    if (open) {
      form.reset({
        entityId: "",
        oldPriceSum: 0,
        newPriceSum: 0,
        discountPercent: 10,
        startDate: "",
        endDate: "",
      });
    }
  }, [open, form]);

  const onSubmit = async (values: FormData) => {
    try {
      const entityType = isBus ? "vehicle" : "room";
      const option = activeOptions.find((o) => o.id === values.entityId);
      const entityName = option ? option.label : "Noma'lum obyekt";

      await promotions.submitPromotion({
        entityId: values.entityId,
        entityName,
        entityType,
        oldPriceSum: values.oldPriceSum,
        newPriceSum: values.newPriceSum,
        discountPercent: values.discountPercent,
        startDate: values.startDate,
        endDate: values.endDate,
      });
      toast.success("Chegirma taklifi yuborildi.");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error("Xatolik yuz berdi");
    }
  };

  const err = form.formState.errors;

  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      title="Yangi chegirma qo'shish"
      description="Sotuvda mavjud (active) xona yoki mashinalar uchun chegirma narxlarini kiriting."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} type="button">Bekor qilish</Button>
          <Button type="submit" form="room-promo-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </div>
      }
    >
      <form id="room-promo-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
        <div className="space-y-1.5">
          <Label htmlFor="entityId">Obyektni tanlang</Label>
          <select
            id="entityId"
            className="flex h-10 w-full rounded-md border border-[var(--border)] bg-transparent px-3 py-2 text-sm ring-offset-[var(--background)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            {...form.register("entityId")}
          >
            <option value="">-- Tanlang --</option>
            {activeOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
          {err.entityId && <p className="text-xs text-red-500">{err.entityId.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="oldPriceSum">Eski narx (UZS)</Label>
          <Input
            id="oldPriceSum"
            type="number"
            {...form.register("oldPriceSum", { valueAsNumber: true })}
          />
          {err.oldPriceSum && <p className="text-xs text-red-500">{err.oldPriceSum.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPriceSum">Yangi narx (UZS / chegirmali)</Label>
          <Input
            id="newPriceSum"
            type="number"
            {...form.register("newPriceSum", { valueAsNumber: true })}
          />
          {err.newPriceSum && <p className="text-xs text-red-500">{err.newPriceSum.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="discountPercent">Chegirma foizi (%)</Label>
          <Input
            id="discountPercent"
            type="number"
            readOnly
            className="bg-[var(--surface-muted)] cursor-not-allowed"
            {...form.register("discountPercent", { valueAsNumber: true })}
          />
          {err.discountPercent && <p className="text-xs text-red-500">{err.discountPercent.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">Boshlanish sanasi</Label>
            <Input
              id="startDate"
              type="date"
              {...form.register("startDate")}
            />
            {err.startDate && <p className="text-xs text-red-500">{err.startDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate">Tugash sanasi</Label>
            <Input
              id="endDate"
              type="date"
              {...form.register("endDate")}
            />
            {err.endDate && <p className="text-xs text-red-500">{err.endDate.message}</p>}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
