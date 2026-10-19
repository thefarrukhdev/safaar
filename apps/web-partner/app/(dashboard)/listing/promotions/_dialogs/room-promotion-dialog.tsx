"use client";

import { useEffect, useMemo } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Dialog } from "../../../../_components/ui/dialog";
import { Button } from "../../../../_components/ui/button";
import { Input } from "../../../../_components/ui/input";
import { MoneyInput } from "../../../../_components/ui/money-input";
import { Label } from "../../../../_components/ui/label";
import { Select } from "../../../../_components/ui/select";

import { promotions, type Promotion } from "../../../../_lib/api/endpoints/promotions";
import { useRoomTypes } from "../../../../_hooks/use-room-types";
import { useVehicles } from "../../../../_hooks/use-vehicles";
import { useAuthStore } from "../../../../_stores/auth-store";
import { hasBuses } from "../../../../_lib/utils/partner-labels";

const schema = z
  .object({
    entityId: z.string().min(1, "Obyektni tanlang"),
    oldPriceSum: z.number().min(1000, "Kamida 1000 so'm bo'lishi kerak"),
    newPriceSum: z.number().min(1000, "Kamida 1000 so'm bo'lishi kerak"),
    discountPercent: z.number().min(1, "Kamida 1% bo'lishi kerak").max(99, "Maksimum 99%"),
    startDate: z.string().min(1, "Boshlanish sanasini kiriting"),
    endDate: z.string().min(1, "Tugash sanasini kiriting"),
  })
  .refine((data) => data.newPriceSum < data.oldPriceSum, {
    message: "Yangi narx eski narxdan kichik bo'lishi kerak",
    path: ["newPriceSum"],
  })
  .refine((data) => !data.startDate || !data.endDate || data.endDate >= data.startDate, {
    message: "Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas",
    path: ["endDate"],
  });

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
  onSuccess: (created: Promotion) => void;
}

export function RoomPromotionDialog({ open, onClose, onSuccess }: Props) {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);
  const isBus = hasBuses(partnerType);

  const { data: roomTypes = [] } = useRoomTypes();
  const { data: vehicles = [] } = useVehicles();

  const activeOptions = useMemo(() => {
    if (isBus) {
      return vehicles
        .filter((v) => v.status === "active")
        .map((v) => ({
          id: v.id,
          label: `${v.plateNumber} (${v.name})`,
          type: "vehicle" as const,
          price: v.pricePerDay || 0,
        }));
    } else {
      return roomTypes.map((rt) => ({
        id: rt.id,
        label: `Xona turi: ${rt.name}`,
        type: "roomType" as const,
        price: rt.basePrice || 0,
      }));
    }
  }, [roomTypes, vehicles, isBus]);

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      entityId: "",
      oldPriceSum: 0,
      newPriceSum: 0,
      discountPercent: 10,
      startDate: "",
      endDate: "",
    },
  });

  const selectedEntityId = useWatch({ control: form.control, name: "entityId" });
  const discountPercent = useWatch({ control: form.control, name: "discountPercent" });

  useEffect(() => {
    if (selectedEntityId) {
      const option = activeOptions.find((o) => o.id === selectedEntityId);
      if (option && option.price > 0) {
        form.setValue("oldPriceSum", option.price, { shouldValidate: true });
        const percent = form.getValues("discountPercent") || 10;
        const discounted = Math.round(option.price * (1 - percent / 100));
        form.setValue("newPriceSum", discounted, { shouldValidate: true });
      }
    }
  }, [selectedEntityId, activeOptions, form]);

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

  const handlePercentChange = (percent: number) => {
    const clamped = Math.max(1, Math.min(99, percent));
    form.setValue("discountPercent", clamped, { shouldValidate: true });
    const oldPrice = form.getValues("oldPriceSum");
    if (oldPrice > 0) {
      const discounted = Math.round(oldPrice * (1 - clamped / 100));
      form.setValue("newPriceSum", discounted, { shouldValidate: true });
    }
  };

  const handleNewPriceChange = (price: number) => {
    form.setValue("newPriceSum", price, { shouldValidate: true });
    const oldPrice = form.getValues("oldPriceSum");
    if (oldPrice > 0 && price > 0 && price < oldPrice) {
      const diff = oldPrice - price;
      const percent = Math.round((diff / oldPrice) * 100);
      form.setValue("discountPercent", Math.min(99, Math.max(1, percent)), { shouldValidate: true });
    }
  };

  const onSubmit = async (values: FormData) => {
    try {
      const entityType = isBus ? "vehicle" : "room";
      const option = activeOptions.find((o) => o.id === values.entityId);
      const entityName = option ? option.label : "Noma'lum obyekt";

      const created = await promotions.submitPromotion(
        {
          entityId: values.entityId,
          entityName,
          entityType,
          oldPriceSum: values.oldPriceSum,
          newPriceSum: values.newPriceSum,
          discountPercent: values.discountPercent,
          startDate: values.startDate,
          endDate: values.endDate,
        },
        accessToken,
      );
      toast.success("Chegirma taklifi muvaffaqiyatli yuborildi.");
      onSuccess(created);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
    }
  };

  const err = form.formState.errors;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Yangi chegirma qo'shish"
      description="Sotuvda mavjud bo'lgan xona yoki transport vositalari uchun maxsus chegirma taklifini belgilang."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} type="button" disabled={form.formState.isSubmitting}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            form="room-promo-form"
            disabled={form.formState.isSubmitting}
            loading={form.formState.isSubmitting}
          >
            Saqlash
          </Button>
        </div>
      }
    >
      <form id="room-promo-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-1">
        <div className="space-y-1.5">
          <Label htmlFor="entityId">Obyektni tanlang</Label>
          <Select
            id="entityId"
            value={selectedEntityId}
            error={Boolean(err.entityId)}
            onChange={(e) => form.setValue("entityId", e.target.value, { shouldValidate: true })}
          >
            <option value="">-- Tanlang --</option>
            {activeOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>
                {opt.label} ({opt.price.toLocaleString("uz-UZ")} so'm)
              </option>
            ))}
          </Select>
          {err.entityId && <p className="text-xs text-red-500">{err.entityId.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="oldPriceSum">Eski narx (so'm)</Label>
            <Controller
              control={form.control}
              name="oldPriceSum"
              render={({ field }) => (
                <MoneyInput
                  id="oldPriceSum"
                  placeholder="500 000"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                  aria-invalid={Boolean(err.oldPriceSum)}
                />
              )}
            />
            {err.oldPriceSum && <p className="text-xs text-red-500">{err.oldPriceSum.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="discountPercent">Chegirma foizi (%)</Label>
            <Input
              id="discountPercent"
              type="number"
              min={1}
              max={99}
              value={discountPercent || 10}
              onChange={(e) => handlePercentChange(Number(e.target.value) || 1)}
              aria-invalid={Boolean(err.discountPercent)}
            />
            {err.discountPercent && <p className="text-xs text-red-500">{err.discountPercent.message}</p>}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPriceSum">Chegirmali yangi narx (so'm)</Label>
          <Controller
            control={form.control}
            name="newPriceSum"
            render={({ field }) => (
              <MoneyInput
                id="newPriceSum"
                placeholder="450 000"
                value={field.value}
                onChange={(e) => handleNewPriceChange(Number(e.target.value) || 0)}
                aria-invalid={Boolean(err.newPriceSum)}
              />
            )}
          />
          {err.newPriceSum && <p className="text-xs text-red-500">{err.newPriceSum.message}</p>}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="startDate">Boshlanish sanasi</Label>
            <Input
              id="startDate"
              type="date"
              aria-invalid={Boolean(err.startDate)}
              {...form.register("startDate")}
            />
            {err.startDate && <p className="text-xs text-red-500">{err.startDate.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="endDate">Tugash sanasi</Label>
            <Input
              id="endDate"
              type="date"
              aria-invalid={Boolean(err.endDate)}
              {...form.register("endDate")}
            />
            {err.endDate && <p className="text-xs text-red-500">{err.endDate.message}</p>}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
