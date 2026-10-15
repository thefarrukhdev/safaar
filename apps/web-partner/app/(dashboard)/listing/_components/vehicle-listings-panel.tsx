'use client';

import { CarFront, Pencil, Plus } from 'lucide-react';
import { Button } from '../../../_components/ui/button';
import { Card, CardBody } from '../../../_components/ui/card';
import { useUpdateVehicle } from '../../../_hooks/use-vehicles';
import { cn } from '../../../_lib/utils/cn';
import { formatMoney } from '../../../_lib/utils/format';

interface VehicleListingsPanelProps {
  vehicles: any[];
  onAdd: () => void;
  onEdit: (vehicle: any) => void;
}

export function VehicleListingsPanel({
  vehicles,
  onAdd,
  onEdit,
}: VehicleListingsPanelProps) {
  const updateVehicle = useUpdateVehicle();

  const toggleStatus = async (vehicle: any) => {
    const newStatus = vehicle.status === 'active' ? 'inactive' : 'active';
    await updateVehicle.mutateAsync({
      id: vehicle.id,
      values: { status: newStatus },
    });
  };

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">
              Avtomobillar
            </span>
            <h2 className="mt-1 text-xl font-semibold">
              E'longa chiqarilgan avtomobillar
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              Mijozlar faqat "Faol" holatdagi avtomobillarni ko'radi va bron qila oladi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {vehicles.length > 0 && (
              <Button size="sm" onClick={onAdd}>
                <CarFront className="mr-2 h-4 w-4" aria-hidden />
                Avtomobil qo'shish
              </Button>
            )}
          </div>
        </div>

        {vehicles.length === 0 ? (
          <div className="rounded-card border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
            <CarFront
              className="mx-auto h-8 w-8 text-[var(--muted-foreground)]"
              aria-hidden
            />
            <h3 className="mt-3 text-sm font-semibold">
              Hali avtomobil yo'q
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">
              Mijozlarga ko'rinishi uchun avval avtomobillarni qo'shing.
            </p>
            <Button className="mt-4" onClick={onAdd}>
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              Birinchi avtomobilni qo'shish
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold">{vehicle.name}</h3>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                          vehicle.status === 'active'
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300",
                        )}
                      >
                        {vehicle.status === 'active' ? "E'londa (Faol)" : 'Yashirilgan'}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-[var(--muted-foreground)]">{vehicle.plateNumber}</p>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <span className="text-[var(--muted-foreground)]">O'rindiqlar:</span>{' '}
                        <span className="font-medium">{vehicle.seatsCount} kishi</span>
                      </div>
                      <div>
                        <span className="text-[var(--muted-foreground)]">Kunlik narxi:</span>{' '}
                        <span className="font-medium text-brand-600 dark:text-brand-400">{formatMoney(vehicle.pricePerDay)}</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2 border-t border-[var(--border)] pt-4">
                  <Button variant="outline" size="sm" className="flex-1" onClick={() => onEdit(vehicle)}>
                    <Pencil className="mr-2 h-4 w-4" /> Tahrirlash
                  </Button>
                  <Button 
                    variant={vehicle.status === 'active' ? 'outline' : 'primary'} 
                    size="sm" 
                    className="flex-1"
                    onClick={() => toggleStatus(vehicle)}
                    disabled={updateVehicle.isPending}
                  >
                    {vehicle.status === 'active' ? "E'londan olish" : "E'longa chiqarish"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
