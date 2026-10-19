"use client";

import { useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, Ban, CalendarRange } from "lucide-react";
import { Button } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select } from "../ui/select";
import { DateRangePicker } from "../ui/date-range-picker";
import { TODAY_ISO } from "../../_lib/utils/date";
import { useAuthStore } from "../../_stores/auth-store";
import { useRooms } from "../../_hooks/use-rooms";
import { getPartnerLabels, isDacha } from "../../_lib/utils/partner-labels";
import { blackoutDates } from "../../_lib/api/endpoints/partners";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const schema = z.object({
  roomNumber: z.string().min(1, "Xonani tanlang"),
  startDate: z.string().min(1, "Boshlanish sanasini tanlang"),
  endDate: z.string().min(1, "Tugash sanasini tanlang"),
  reason: z.string().optional(),
});

type Values = z.infer<typeof schema>;

interface BlackoutDialogProps {
  open: boolean;
  onClose: () => void;
  hotelId: string | undefined;
}

export function BlackoutDialog({ open, onClose, hotelId }: BlackoutDialogProps) {
  const { data: rooms = [] } = useRooms();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const unitCap = labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1);
  const dacha = isDacha(partnerType);

  const authHotelId = useAuthStore((s) => s.user?.organizationId);
  const effectiveHotelId = hotelId || authHotelId;
  const queryClient = useQueryClient();
  const defaultCheckIn = TODAY_ISO;
  const dachaRoom = dacha ? rooms[0] : undefined;
  const defaultRoomNumber = dacha ? (dachaRoom?.number ?? "1") : (dachaRoom?.number ?? "");

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      roomNumber: defaultRoomNumber,
      startDate: defaultCheckIn,
      endDate: defaultCheckIn,
      reason: "",
    },
  });

  const startDate = useWatch({ control: form.control, name: "startDate" }) ?? defaultCheckIn;
  const endDate = useWatch({ control: form.control, name: "endDate" }) ?? defaultCheckIn;
  const watchedRoomNumber = useWatch({ control: form.control, name: "roomNumber" }) ?? "";

  useEffect(() => {
    if (open) {
      form.reset({
        roomNumber: dacha ? (dachaRoom?.number ?? "1") : (dachaRoom?.number ?? ""),
        startDate: defaultCheckIn,
        endDate: defaultCheckIn,
        reason: "",
      });
    }
  }, [open, dacha, dachaRoom, form, defaultCheckIn]);

  const mutation = useMutation({
    mutationFn: async (values: Values) => {
      if (!effectiveHotelId) throw new Error("Hotel ID mavjud emas");
      await blackoutDates(effectiveHotelId, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast.success("Inventar muvaffaqiyatli sotuvdan yopildi");
      onClose();
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Xatolik yuz berdi");
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    if (new Date(values.endDate).getTime() < new Date(values.startDate).getTime()) {
      toast.error("Tugash sanasi boshlanish sanasidan oldin bo'lishi mumkin emas");
      return;
    }
    mutation.mutate(values);
  });

  const err = form.formState.errors;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Inventarni yopish (Blackout)"
      description="Ta'mirlash yoki profilaktika sababli sotuvni to'xtatish."
      size="lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={mutation.isPending}>
            Bekor qilish
          </Button>
          <Button
            type="submit"
            form="blackout-form"
            disabled={mutation.isPending}
            loading={mutation.isPending}
            className="bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white shadow-sm transition-all"
          >
            <Ban className="h-4 w-4 mr-1.5" />
            Sotuvni to'xtatish
          </Button>
        </div>
      }
    >
      <form id="blackout-form" onSubmit={onSubmit} className="flex flex-col gap-5">
        {/* Apple-style alert notice */}
        <div className="flex items-start gap-3 rounded-xl border border-amber-200/80 bg-amber-50/70 p-3.5 text-xs text-amber-900 backdrop-blur-sm dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="flex-1 leading-relaxed">
            <span className="font-semibold">Diqqat:</span> Tanlangan muddat davomida ushbu {labels.unitSingular} uchun mehmonlar tomonidan yangi bronlar qabul qilinmaydi.
          </div>
        </div>

        {/* Room / Unit selector */}
        {!dacha && (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="roomNumber">{unitCap}</Label>
            <Select
              id="roomNumber"
              value={watchedRoomNumber}
              error={Boolean(err.roomNumber)}
              aria-describedby={err.roomNumber ? "roomNumber-error" : undefined}
              {...form.register("roomNumber")}
            >
              <option value="">{unitCap}ni tanlang</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.number}>
                  {r.number} {r.roomTypeName ? `(${r.roomTypeName})` : ""}
                </option>
              ))}
            </Select>
            {err.roomNumber && (
              <p id="roomNumber-error" className="text-xs text-red-600 dark:text-red-400">
                {err.roomNumber.message}
              </p>
            )}
          </div>
        )}

        {/* PMS DateRangePicker */}
        <div className="flex flex-col gap-1.5">
          <Label className="flex items-center gap-1.5">
            <CalendarRange className="h-3.5 w-3.5 text-slate-400 dark:text-zinc-500" />
            Yopilish sanalari oralig'i
          </Label>
          <DateRangePicker
            startDate={startDate}
            endDate={endDate}
            onChange={(range) => {
              form.setValue("startDate", range.startDate, { shouldValidate: true });
              form.setValue("endDate", range.endDate, { shouldValidate: true });
            }}
            showPresets={false}
            className="w-full"
          />
          {(err.startDate || err.endDate) && (
            <p className="text-xs text-red-600 dark:text-red-400">
              {err.startDate?.message || err.endDate?.message}
            </p>
          )}
        </div>

        {/* Reason field */}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="reason">Sabab (ixtiyoriy)</Label>
          <Input
            id="reason"
            placeholder="Masalan: Ta'mirlash, profilaktika yoki dezinfeksiya"
            className="h-10"
            {...form.register("reason")}
          />
        </div>
      </form>
    </Dialog>
  );
}
