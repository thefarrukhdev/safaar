"use client";

import { Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../_components/ui/button";
import { Drawer } from "../../../_components/ui/drawer";
import {
  useListing,
  useUpdateListingAmenities,
} from "../../../_hooks/use-listing";
import { useAuthStore } from "../../../_stores/auth-store";
import { cn } from "../../../_lib/utils/cn";
import { useAmenities } from "../../../_hooks/use-catalog";
import { useMemo } from "react";

export function AmenitiesEditor({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data } = useListing();
  const updateAmenities = useUpdateListingAmenities();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const { data: allAmenities = [], isLoading } = useAmenities();
  
  const sectionAmenities = useMemo(() => {
    return allAmenities.filter((a: any) => {
      const code = a.code || '';
      if (partnerType === 'restaurant') return code.startsWith('restaurant_');
      if (partnerType === 'dacha') return code.startsWith('dacha_');
      if (partnerType === 'bus' || partnerType === 'transport') return code.startsWith('transport_') || code.startsWith('bus_');
      
      // Default / Hotel
      return code.startsWith('hotel_') || !code.includes('_');
    }).map((a: any) => ({
      id: a.code,
      label: typeof a.name === 'string' ? a.name : ((a.name as any)?.uz || a.code)
    }));
  }, [allAmenities, partnerType]);

  const groups = [
    {
      key: "general",
      label: "Barcha qulayliklar",
      items: sectionAmenities,
    }
  ];

  const selected = new Set(data.amenities);

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Qulayliklar"
      description={`${selected.size} ta belgilangan. O'zgarishlar avtomatik saqlanadi.`}
      size="lg"
      footer={
        <Button onClick={onClose}>Yopish</Button>
      }
    >
      <div className="flex flex-col gap-6">
        {isLoading ? (
          <div className="flex justify-center p-8">Yuklanmoqda...</div>
        ) : sectionAmenities.length === 0 ? (
          <div className="text-center text-sm text-[var(--muted-foreground)] py-8">
            Hozircha qulayliklar qo'shilmagan.
          </div>
        ) : (
          groups.map((group) => (
          <div key={group.key} className="flex flex-col gap-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              {group.label}
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              {group.items.map((item: any) => {
                const isOn = selected.has(item.id);
                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant={isOn ? "secondary" : "ghost"}
                    size="sm"
                    onClick={() => {
                      const next = isOn
                        ? data.amenities.filter((id) => id !== item.id)
                        : [...data.amenities, item.id];
                      updateAmenities.mutate(next, {
                        onError: (error) => {
                          toast.error(
                            error instanceof Error
                              ? error.message
                              : "Qulayliklarni saqlab bo'lmadi",
                          );
                        },
                      });
                    }}
                    disabled={updateAmenities.isPending}
                    aria-pressed={isOn}
                    className={cn(
                      "flex items-center justify-start gap-2 h-auto py-2 px-3 text-left text-sm border font-normal",
                      isOn
                        ? "border-brand-500 bg-brand-50 text-brand-900 dark:bg-brand-900/40 dark:text-brand-100"
                        : "border-[var(--border)] bg-[var(--surface)] text-zinc-700 hover:border-[var(--border-strong)] hover:bg-[var(--surface-muted)] dark:text-zinc-300",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-5 w-5 shrink-0 items-center justify-center rounded border-2 transition-colors",
                        isOn
                          ? "border-brand-600 bg-brand-600"
                          : "border-zinc-300 dark:border-zinc-600",
                      )}
                    >
                      {isOn && (
                        <Check
                          className="h-3 w-3 text-white"
                          aria-hidden
                          strokeWidth={3}
                        />
                      )}
                    </span>
                    <span className="flex-1 truncate">{item.label}</span>
                  </Button>
                );
              })}
            </div>
          </div>
          ))
        )}
      </div>
    </Drawer>
  );
}
