'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Car, ShieldCheck, Utensils, Waves, Wifi, type LucideIcon } from 'lucide-react';
import type { HotelDetailDict } from '@/i18n/dictionaries';

const AMENITY_ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  pool: Waves,
  parking: Car,
  restaurant: Utensils,
  security: ShieldCheck,
};

export function HotelAmenities({
  amenities,
  amenityName,
  dict,
}: {
  amenities: string[];
  amenityName: Record<string, string>;
  dict: HotelDetailDict;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const visibleAmenities = amenities.slice(0, 6);

  if (amenities.length === 0) return null;

  return (
    <section className="flex flex-col gap-6 border-t border-slate-200 py-8 first:border-t-0 first:pt-0">
      <h2 className="text-2xl font-bold text-slate-900">{typeof dict.amenities === "string" ? dict.amenities : dict.amenities.title}</h2>
      <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {visibleAmenities.map((id) => {
          const Icon = AMENITY_ICONS[id];
          return (
            <li
              key={id}
              className="flex items-center gap-4 text-base text-slate-700"
            >
              {Icon && <Icon className="h-6 w-6 text-slate-700" strokeWidth={1.5} />}
              <span>{amenityName[id] ?? id}</span>
            </li>
          );
        })}
      </ul>
      {amenities.length > 6 && (
        <div>
          <Button
            variant="secondary"
            size="lg"
            className="border-slate-900 text-slate-900 bg-white hover:bg-slate-50 border font-semibold px-6"
            onClick={() => setIsOpen(true)}
          >
            {(dict.amenities.showAll).replace("{count}", String(amenities.length))}
          </Button>
        </div>
      )}

      <Modal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        title={typeof dict.amenities === "string" ? dict.amenities : dict.amenities.title}
      >
        <div className="flex flex-col gap-6">
          <ul className="flex flex-col gap-6">
            {amenities.map((id) => {
              const Icon = AMENITY_ICONS[id];
              return (
                <li
                  key={id}
                  className="flex items-center gap-4 text-base text-slate-700 border-b border-slate-200 pb-4 last:border-b-0 last:pb-0"
                >
                  {Icon && <Icon className="h-6 w-6 text-slate-700" strokeWidth={1.5} />}
                  <span>{amenityName[id] ?? id}</span>
                </li>
              );
            })}
          </ul>
        </div>
      </Modal>
    </section>
  );
}
