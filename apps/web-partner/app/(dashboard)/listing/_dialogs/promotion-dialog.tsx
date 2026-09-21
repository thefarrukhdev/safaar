"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { toast } from "sonner";
import { Dialog } from "../../../_components/ui/dialog";
import { Button } from "../../../_components/ui/button";
import { Input } from "../../../_components/ui/input";
import { Label } from "../../../_components/ui/label";
import { promotions } from "../../../_lib/api/endpoints/promotions";

const schema = z.object({
  oldPriceSum: z.number().min(1000, "Kamida 1000 so'm bo'lishi kerak"),
  newPriceSum: z.number().min(1000, "Kamida 1000 so'm bo'lishi kerak"),
  discountPercent: z.number().min(1, "Kamida 1% bo'lishi kerak").max(99, "Maksimum 99%"),
  endsAt: z.string().min(1, "Muddatni kiriting"),
}).refine(data => data.newPriceSum < data.oldPriceSum, {
  message: "Yangi narx eski narxdan kichik bo'lishi kerak",
  path: ["newPriceSum"],
});

type FormData = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onClose: () => void;
}

export function PromotionDialog({ open, onClose }: Props) {
  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      oldPriceSum: 0,
      newPriceSum: 0,
      discountPercent: 10,
      endsAt: "",
    }
  });

  // Watch for changes to auto-calculate discount percent
  const oldPriceSum = form.watch("oldPriceSum");
  const newPriceSum = form.watch("newPriceSum");

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
        oldPriceSum: 0,
        newPriceSum: 0,
        discountPercent: 10,
        endsAt: "",
      });
    }
  }, [open, form]);

  const onSubmit = async (values: FormData) => {
    try {
      // Mock API chaqiruvi
      await promotions.submitPromotion(values);
      toast.success("Chegirma taklifi yuborildi. Admin tasdiqlagach e'longa chiqadi.");
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
      title="Chegirma e'lon qilish"
      description="Ushbu e'loningiz uchun chegirma taklifini yuboring. Admin tasdiqlaganidan keyin saytda chegirma belgisi bilan chiqadi."
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} type="button">Bekor qilish</Button>
          <Button type="submit" form="promo-form" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? "Yuborilmoqda..." : "Tasdiqqa yuborish"}
          </Button>
        </div>
      }
    >
      <form id="promo-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
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
          <Label htmlFor="newPriceSum">Yangi narx (UZS)</Label>
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
            {...form.register("discountPercent", { valueAsNumber: true })}
          />
          {err.discountPercent && <p className="text-xs text-red-500">{err.discountPercent.message}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="endsAt">Qachongacha amal qiladi?</Label>
          <Input
            id="endsAt"
            type="datetime-local"
            {...form.register("endsAt")}
          />
          {err.endsAt && <p className="text-xs text-red-500">{err.endsAt.message}</p>}
        </div>
      </form>
    </Dialog>
  );
}
