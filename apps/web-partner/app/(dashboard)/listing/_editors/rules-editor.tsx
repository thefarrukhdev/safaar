"use client";

import { Baby, Cigarette, Dog, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Button } from "../../../_components/ui/button";
import { Drawer } from "../../../_components/ui/drawer";
import { EmptyState } from "../../../_components/ui/empty-state";
import { Input } from "../../../_components/ui/input";
import { Label } from "../../../_components/ui/label";
import { Tooltip } from "../../../_components/ui/tooltip";
import {
  useListing,
  useUpdateListingRules,
} from "../../../_hooks/use-listing";
import { useRoomTypes, useCreateRoomType, useUpdateRoomType } from "../../../_hooks/use-room-types";
import { useRooms, useCreateRoom } from "../../../_hooks/use-rooms";
import { useAuthStore } from "../../../_stores/auth-store";
import { getPartnerLabels, isRestaurant, isDacha, hasBuses } from "../../../_lib/utils/partner-labels";
import {
  CANCELLATION_POLICY_INFO,
  CancellationPolicy,
} from "../../../_lib/domain/listing";
import { RoomStatus } from "../../../_lib/domain/types";
import { cn } from "../../../_lib/utils/cn";
import { formatMoney } from "../../../_lib/utils/format";

const schema = z.object({
  checkInTime: z.string().regex(/^\d{2}:\d{2}$/, "Format: 14:00"),
  checkOutTime: z.string().regex(/^\d{2}:\d{2}$/, "Format: 12:00"),
  cancellationPolicy: z.nativeEnum(CancellationPolicy),
  smokingAllowed: z.boolean(),
  petsAllowed: z.boolean(),
  childrenAllowed: z.boolean(),
  dachaPrice: z.number().min(0).optional(),
  dachaCapacity: z.number().min(1).optional(),
  dachaRoomsCount: z.number().min(1).optional(),
});

type Values = z.infer<typeof schema>;

export function RulesEditor({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data } = useListing();
  const update = useUpdateListingRules();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const restaurant = isRestaurant(partnerType);
  const dacha = isDacha(partnerType);
  const isBus = hasBuses(partnerType);

  const { data: roomTypes } = useRoomTypes();
  const roomType = roomTypes[0];
  const createRoomType = useCreateRoomType();
  const updateRoomType = useUpdateRoomType();
  const { data: rooms } = useRooms();
  const createRoom = useCreateRoom();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...data,
      dachaPrice: roomType?.basePrice ?? 0,
      dachaCapacity: roomType?.capacity ?? 2,
      dachaRoomsCount: parseInt(roomType?.description || "3", 10) || 3,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        ...data,
        dachaPrice: roomType?.basePrice ?? 0,
        dachaCapacity: roomType?.capacity ?? 2,
        dachaRoomsCount: parseInt(roomType?.description || "3", 10) || 3,
      });
    }
  }, [open, data, form, roomType]);

  const watched = useWatch({ control: form.control });
  const currentPolicy = watched.cancellationPolicy ?? data.cancellationPolicy;
  const smokingAllowed = watched.smokingAllowed ?? data.smokingAllowed;
  const petsAllowed = watched.petsAllowed ?? data.petsAllowed;
  const childrenAllowed = watched.childrenAllowed ?? data.childrenAllowed;

  const onSave = form.handleSubmit(async (v) => {
    try {
      await update.mutateAsync({ ...v, extraFees: data.extraFees });
      
      if (dacha) {
        const rtValues = {
          name: "Asosiy",
          basePrice: v.dachaPrice ?? 0,
          capacity: v.dachaCapacity ?? 2,
          description: v.dachaRoomsCount ? String(v.dachaRoomsCount) : "3",
          amenities: roomType?.amenities ?? [],
        };
        let finalRoomTypeId = roomType?.id;
        if (roomType) {
          await updateRoomType.mutateAsync({ id: roomType.id, values: rtValues });
        } else {
          const newRt = await createRoomType.mutateAsync(rtValues);
          finalRoomTypeId = newRt?.id;
        }

        if (finalRoomTypeId && rooms.length === 0) {
          await createRoom.mutateAsync({
            number: "Asosiy",
            floor: 1,
            roomTypeId: finalRoomTypeId,
            status: RoomStatus.VACANT_CLEAN,
            isListed: true,
          });
        }
      }

      toast.success("Uy qoidalari saqlandi");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Qoidalarni saqlab bo'lmadi",
      );
    }
  });

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={dacha ? "Xonalar, narx va qoidalar" : isBus ? "Ijara qoidalari" : "Uy qoidalari"}
      description={dacha ? "Dacha narxi, sig'imi, ish vaqtlari va bekor qilish siyosati." : "Ish vaqtlari, bekor qilish siyosati va qo'shimcha to'lovlar."}
      size="lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Bekor
          </Button>
          <Button
            onClick={onSave}
            disabled={!form.formState.isDirty || update.isPending || createRoomType.isPending || updateRoomType.isPending}
          >
            Saqlash
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {dacha && (
          <section className="flex flex-col gap-3 border-b border-[var(--border)] pb-6">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Dacha ma'lumotlari
            </h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dachaRoomsCount">Xonalar soni</Label>
                <Input
                  id="dachaRoomsCount"
                  type="number"
                  min={1}
                  {...form.register("dachaRoomsCount", { valueAsNumber: true })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dachaCapacity">Sig'imi (necha kishi)</Label>
                <Input
                  id="dachaCapacity"
                  type="number"
                  min={1}
                  {...form.register("dachaCapacity", { valueAsNumber: true })}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="dachaPrice">1 kechalik narx (so'm)</Label>
                <Input
                  id="dachaPrice"
                  type="number"
                  min={0}
                  step={10000}
                  {...form.register("dachaPrice", { valueAsNumber: true })}
                />
              </div>
            </div>
          </section>
        )}
        {/* Vaqtlar */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            {labels.checkInLabel} va {labels.checkOutLabel.toLowerCase()}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="in">{labels.checkInLabel}</Label>
              <Input
                id="in"
                type="time"
                {...form.register("checkInTime")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="out">{labels.checkOutLabel}</Label>
              <Input
                id="out"
                type="time"
                {...form.register("checkOutTime")}
              />
            </div>
          </div>
        </section>

        {/* Bekor qilish */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Bekor qilish siyosati
          </h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {Object.values(CancellationPolicy).map((policy) => {
              const info = CANCELLATION_POLICY_INFO[policy];
              const selected = currentPolicy === policy;
              return (
                <label
                  key={policy}
                  className={cn(
                    "flex cursor-pointer flex-col gap-1 rounded-lg border p-3 transition-all",
                    selected
                      ? "border-brand-500 bg-brand-50 dark:bg-brand-900/30"
                      : "border-[var(--border)] hover:border-[var(--border-strong)]",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      value={policy}
                      checked={selected}
                      onChange={() =>
                        form.setValue("cancellationPolicy", policy, {
                          shouldDirty: true,
                        })
                      }
                      className="h-4 w-4 accent-brand-700"
                    />
                    <span className="font-semibold">{info.label}</span>
                  </div>
                  <p className="ml-6 text-xs text-[var(--muted-foreground)]">
                    {info.description}
                  </p>
                </label>
              );
            })}
          </div>
        </section>

        {/* Qo'shimcha qoidalar */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Qo'shimcha qoidalar
          </h3>
          <div className="flex flex-col gap-2">
            <RuleToggle
              icon={<Cigarette className="h-4 w-4" aria-hidden />}
              label="Chekish ruxsat etilgan"
              checked={smokingAllowed}
              onChange={(v) =>
                form.setValue("smokingAllowed", v, { shouldDirty: true })
              }
            />
            <RuleToggle
              icon={<Dog className="h-4 w-4" aria-hidden />}
              label="Uy hayvonlari ruxsat etilgan"
              checked={petsAllowed}
              onChange={(v) =>
                form.setValue("petsAllowed", v, { shouldDirty: true })
              }
            />
            {!restaurant && (
              <RuleToggle
                icon={<Baby className="h-4 w-4" aria-hidden />}
                label="Bolalar bilan mos"
                checked={childrenAllowed}
                onChange={(v) =>
                  form.setValue("childrenAllowed", v, { shouldDirty: true })
                }
              />
            )}
          </div>
        </section>

        {/* Qo'shimcha to'lovlar */}
        <section className="flex flex-col gap-3">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
            Qo'shimcha to'lovlar
          </h3>
          <ExtraFeesEditor
            fees={data.extraFees}
            restaurant={restaurant}
            onAdd={(fee) => {
              update.mutate(
                {
                  ...form.getValues(),
                  extraFees: [
                    ...data.extraFees,
                    { ...fee, id: crypto.randomUUID() },
                  ],
                },
                {
                  onSuccess: () => toast.success("Qo'shildi"),
                  onError: (error) => {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "To'lovni saqlab bo'lmadi",
                    );
                  },
                },
              );
            }}
            onRemove={(id) => {
              update.mutate(
                {
                  ...form.getValues(),
                  extraFees: data.extraFees.filter((fee) => fee.id !== id),
                },
                {
                  onSuccess: () => toast.success("O'chirildi"),
                  onError: (error) => {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : "To'lovni o'chirib bo'lmadi",
                    );
                  },
                },
              );
            }}
          />
        </section>
      </div>
    </Drawer>
  );
}

function RuleToggle({
  icon,
  label,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border)] p-3 hover:bg-[var(--surface-muted)]">
      <div className="flex items-center gap-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--surface-muted)] text-[var(--muted-foreground)]">
          {icon}
        </span>
        <span className="font-medium">{label}</span>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-5 w-5 accent-brand-700"
      />
    </label>
  );
}

function ExtraFeesEditor({
  fees,
  restaurant,
  onAdd,
  onRemove,
}: {
  fees: import("../../../_lib/domain/listing").ExtraFee[];
  restaurant: boolean;
  onAdd: (
    fee: Omit<import("../../../_lib/domain/listing").ExtraFee, "id">,
  ) => void;
  onRemove: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [charge, setCharge] = useState<
    "per_stay" | "per_night" | "per_person"
  >("per_stay");
  const [required, setRequired] = useState(true);

  const chargeLabel = {
    per_stay: "Butun bron",
    per_night: restaurant ? "Har bron" : "Har kecha",
    per_person: "Har mehmon",
  };

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const amt = Number(amount);
          if (!name.trim() || !Number.isFinite(amt) || amt <= 0) {
            toast.error("Nom va summa kiriting");
            return;
          }
          onAdd({ name: name.trim(), amount: amt, charge, required });
          setName("");
          setAmount("");
        }}
        className="grid gap-2"
      >
        <div className="grid gap-2 sm:grid-cols-2">
          <Input
            placeholder="Nomi (masalan: Turist soligi)"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            type="number"
            min={0}
            step={1000}
            placeholder="Summa (so'm)"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <select
            value={charge}
            onChange={(e) => setCharge(e.target.value as typeof charge)}
            className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm focus:border-brand-600 focus:outline-none"
          >
            <option value="per_stay">Butun bron uchun</option>
            <option value="per_night">{restaurant ? "Har bron uchun" : "Har kecha uchun"}</option>
            <option value="per_person">Har mehmon uchun</option>
          </select>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 text-sm">
            <input
              type="checkbox"
              checked={required}
              onChange={(e) => setRequired(e.target.checked)}
              className="h-4 w-4 accent-brand-700"
            />
            Majburiy
          </label>
          <Button type="submit">
            <Plus className="h-4 w-4" aria-hidden />
            Qo'shish
          </Button>
        </div>
      </form>

      {fees.length === 0 ? (
        <EmptyState
          title="Qo'shimcha to'lov yo'q"
          description="Turist soligi, garov puli va h.k."
        />
      ) : (
        <ul className="divide-y divide-[var(--border)] rounded-card border border-[var(--border)]">
          {fees.map((fee) => (
            <li
              key={fee.id}
              className="flex items-center justify-between gap-2 px-4 py-2.5"
            >
              <div className="flex flex-col">
                <span className="font-medium">
                  {fee.name}
                  {!fee.required && (
                    <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      Ixtiyoriy
                    </span>
                  )}
                </span>
                <span className="text-xs text-[var(--muted-foreground)]">
                  {formatMoney(fee.amount)} — {chargeLabel[fee.charge]}
                </span>
              </div>
              <Tooltip content="O'chirish">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => onRemove(fee.id)}
                  aria-label="O'chirish"
                  className="text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </Button>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
