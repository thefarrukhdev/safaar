"use client";

import { Star } from "lucide-react";
import { useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "../../../_components/ui/button";
import { Drawer } from "../../../_components/ui/drawer";
import { Input } from "../../../_components/ui/input";
import { Label } from "../../../_components/ui/label";
import {
  useListing,
  useUpdateListingGeneral,
} from "../../../_hooks/use-listing";
import { useAuthStore } from "../../../_stores/auth-store";
import { getPartnerLabels, hasBuses, hasStarRating, isDacha, isRestaurant } from "../../../_lib/utils/partner-labels";
import { cn } from "../../../_lib/utils/cn";

function buildSchema(requireStars: boolean) {
  return z.object({
    name: z.string().min(3, "Nomi kamida 3 belgi").max(100, "Max 100 belgi"),
    stars: requireStars
      ? z.number().int().min(1, "Yulduzlarni tanlang").max(5)
      : z.number().int().min(0).max(5),
    shortDescription: z.string().min(20, "Kamida 20 belgi").max(200, "Max 200"),
    fullDescription: z.string().min(100, "Kamida 100 belgi").max(2000, "Max 2000"),
  });
}

type Values = z.infer<ReturnType<typeof buildSchema>>;

export function GeneralEditor({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data } = useListing();
  const update = useUpdateListingGeneral();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const showStars = hasStarRating(partnerType);
  const restaurant = isRestaurant(partnerType);
  const dacha = isDacha(partnerType);
  const isBus = hasBuses(partnerType);
  const labels = getPartnerLabels(partnerType);
  const schema = useMemo(() => buildSchema(showStars), [showStars]);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: data,
  });

  useEffect(() => {
    if (open) form.reset(data);
  }, [open, data, form]);

  const watched = useWatch({ control: form.control });
  const currentStars = watched.stars ?? data.stars;
  const shortLen = watched.shortDescription?.length ?? 0;
  const fullLen = watched.fullDescription?.length ?? 0;

  const onSave = form.handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      toast.success("Umumiy ma'lumotlar saqlandi");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Ma'lumotlarni saqlab bo'lmadi",
      );
    }
  });

  const err = form.formState.errors;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Umumiy ma'lumotlar"
      description={`Nomi, tavsif${showStars ? " va yulduzlar" : ""}.`}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Bekor qilish
          </Button>
          <Button
            onClick={onSave}
            disabled={!form.formState.isDirty || update.isPending}
          >
            Saqlash
          </Button>
        </>
      }
    >
      <form className="flex flex-col gap-5" onSubmit={onSave}>
        {/* Nomi */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="e-name">Nomi</Label>
          <Input
            id="e-name"
            placeholder={
              restaurant
                ? "Osh Markazi Samarqand"
                : isBus
                  ? "Samarkand Rent Car"
                  : dacha
                    ? "Chorvoq Oazis Dacha"
                    : "Hotel Samarkand Plaza"
            }
            aria-invalid={Boolean(err.name)}
            {...form.register("name")}
          />
          {err.name && (
            <p className="text-xs text-red-600">{err.name.message}</p>
          )}
        </div>

        {/* Yulduzlar */}
        {showStars && (
          <div className="flex flex-col gap-1.5">
            <Label>Yulduzlar</Label>
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() =>
                      form.setValue("stars", n, { shouldDirty: true })
                    }
                    aria-label={`${n} yulduz`}
                    className="rounded-md p-1 transition-transform hover:scale-110"
                  >
                    <Star
                      className={cn(
                        "h-7 w-7",
                        n <= currentStars
                          ? "fill-amber-400 stroke-amber-500"
                          : "fill-transparent stroke-zinc-300",
                      )}
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
              <span className="text-sm text-[var(--muted-foreground)]">
                {currentStars} yulduzli
              </span>
            </div>
          </div>
        )}

        {/* Qisqa tavsif */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="e-short">Qisqa tavsif</Label>
            <span
              className={cn(
                "text-xs",
                shortLen < 20 || shortLen > 200
                  ? "text-red-600"
                  : "text-[var(--muted-foreground)]",
              )}
            >
              {shortLen}/200
            </span>
          </div>
          <textarea
            id="e-short"
            rows={2}
            aria-invalid={Boolean(err.shortDescription)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm focus:border-brand-600 focus:outline-none"
            {...form.register("shortDescription")}
          />
          {err.shortDescription && (
            <p className="text-xs text-red-600">
              {err.shortDescription.message}
            </p>
          )}
          <p className="text-xs text-[var(--muted-foreground)]">
            Qidiruv natijalarida ko'rinadi (1-2 gap).
          </p>
        </div>

        {/* Batafsil tavsif */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="e-full">Batafsil tavsif</Label>
            <span
              className={cn(
                "text-xs",
                fullLen < 100 || fullLen > 2000
                  ? "text-red-600"
                  : "text-[var(--muted-foreground)]",
              )}
            >
              {fullLen}/2000
            </span>
          </div>
          <textarea
            id="e-full"
            rows={8}
            aria-invalid={Boolean(err.fullDescription)}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm focus:border-brand-600 focus:outline-none"
            {...form.register("fullDescription")}
          />
          {err.fullDescription && (
            <p className="text-xs text-red-600">
              {err.fullDescription.message}
            </p>
          )}
          <p className="text-xs text-[var(--muted-foreground)]">
            {labels.listingTitle} sahifasida to'liq matn.
          </p>
        </div>
      </form>
    </Drawer>
  );
}
