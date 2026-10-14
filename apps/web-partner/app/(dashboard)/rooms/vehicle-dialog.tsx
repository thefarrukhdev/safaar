"use client";

import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Dialog } from "../../_components/ui/dialog";
import { Button } from "../../_components/ui/button";
import { Input } from "../../_components/ui/input";
import { PlateInput } from "../../_components/ui/plate-input";
import { MoneyInput } from "../../_components/ui/money-input";
import { Label } from "../../_components/ui/label";
import { useCreateVehicle, useUpdateVehicle } from "../../_hooks/use-vehicles";
import type { Vehicle } from "./vehicles-types";

const vehicleSchema = z.object({
  name: z.string().trim().min(2, "Avtomobil rusumini kiriting (masalan, Chevrolet Cobalt)"),
  plateNumber: z
    .string()
    .trim()
    .min(4, "Davlat raqamini to'liq kiriting (masalan, 01 A 777 AA)"),
  seatsCount: z
    .number()
    .int("Butun son kiriting")
    .min(1, "O'rindiqlar soni kamida 1 bo'lishi kerak")
    .max(70, "O'rindiqlar soni 70 tadan oshmasligi kerak"),
  pricePerDay: z
    .number()
    .int("Butun summa kiriting")
    .min(0, "Narx manfiy bo'lishi mumkin emas"),
});

export type VehicleFormValues = z.infer<typeof vehicleSchema>;

export interface VehicleDialogProps {
  open: boolean;
  onClose: () => void;
  editing: Vehicle | null;
}

export function VehicleDialog({ open, onClose, editing }: VehicleDialogProps) {
  const createVehicle = useCreateVehicle();
  const updateVehicle = useUpdateVehicle();

  const form = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleSchema),
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
        form.reset({
          name: "",
          plateNumber: "",
          seatsCount: 4,
          pricePerDay: 300000,
        });
      }
    }
  }, [open, editing, form]);

  const onSubmit = async (values: VehicleFormValues) => {
    try {
      if (editing) {
        await updateVehicle.mutateAsync({
          id: editing.id,
          values: {
            name: values.name,
            plateNumber: values.plateNumber,
            seatsCount: values.seatsCount,
            pricePerDay: values.pricePerDay,
          },
        });
        toast.success("Avtomobil ma'lumotlari muvaffaqiyatli yangilandi");
      } else {
        await createVehicle.mutateAsync({
          name: values.name,
          plateNumber: values.plateNumber,
          seatsCount: values.seatsCount,
          pricePerDay: values.pricePerDay,
          status: "active",
        });
        toast.success("Yangi avtomobil muvaffaqiyatli qo'shildi");
      }
      onClose();
    } catch (e: any) {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Amalni bajarishda xatolik yuz berdi";
      toast.error(msg);
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={editing ? "Avtomobilni tahrirlash" : "Yangi avtomobil qo'shish"}
      description="Avtomobil rusumi, davlat raqami, o'rindiqlar soni va kunlik ijara narxini belgilang."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            form="vehicle-form"
            disabled={isSubmitting}
            className="font-semibold"
          >
            {isSubmitting ? "Saqlanmoqda..." : "Saqlash"}
          </Button>
        </>
      }
    >
      <form
        id="vehicle-form"
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4 py-2"
        noValidate
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Avtomobil rusumi */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="vehicle-name">Avtomobil rusumi va modeli</Label>
            <Input
              id="vehicle-name"
              placeholder="masalan: Chevrolet Cobalt yoki Toyota Land Cruiser"
              aria-invalid={Boolean(form.formState.errors.name)}
              {...form.register("name")}
            />
            {form.formState.errors.name && (
              <span className="text-xs font-medium text-red-500">
                {form.formState.errors.name.message}
              </span>
            )}
          </div>

          {/* Davlat raqami */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vehicle-plate">Davlat raqami</Label>
            <Controller
              control={form.control}
              name="plateNumber"
              render={({ field }) => (
                <PlateInput
                  id="vehicle-plate"
                  placeholder="01 A 777 AA"
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  aria-invalid={Boolean(form.formState.errors.plateNumber)}
                />
              )}
            />
            {form.formState.errors.plateNumber && (
              <span className="text-xs font-medium text-red-500">
                {form.formState.errors.plateNumber.message}
              </span>
            )}
          </div>

          {/* O'rindiqlar soni */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vehicle-seats">O'rindiqlar soni</Label>
            <Input
              id="vehicle-seats"
              type="number"
              min={1}
              max={70}
              placeholder="4"
              aria-invalid={Boolean(form.formState.errors.seatsCount)}
              {...form.register("seatsCount", { valueAsNumber: true })}
            />
            {form.formState.errors.seatsCount && (
              <span className="text-xs font-medium text-red-500">
                {form.formState.errors.seatsCount.message}
              </span>
            )}
          </div>

          {/* Kunlik narxi */}
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="vehicle-price">Kunlik ijara narxi (so'mda)</Label>
            <Controller
              control={form.control}
              name="pricePerDay"
              render={({ field }) => (
                <MoneyInput
                  id="vehicle-price"
                  placeholder="300 000"
                  value={field.value}
                  onChange={(e) => field.onChange(Number(e.target.value) || 0)}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  aria-invalid={Boolean(form.formState.errors.pricePerDay)}
                />
              )}
            />
            {form.formState.errors.pricePerDay && (
              <span className="text-xs font-medium text-red-500">
                {form.formState.errors.pricePerDay.message}
              </span>
            )}
          </div>
        </div>
      </form>
    </Dialog>
  );
}
