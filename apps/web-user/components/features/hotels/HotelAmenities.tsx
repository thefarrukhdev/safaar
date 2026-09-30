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
      <ul className="flex flex-wrap gap-2">
        {visibleAmenities.map((id) => {
          const Icon = AMENITY_ICONS[id];
          return (
            <li
              key={id}
              className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 gap-1.5"
            >
              {Icon && <Icon className="h-4 w-4" strokeWidth={1.5} />}
              <span>{amenityName[id] ?? id}</span>
            </li>
          );
        })}
      </ul>
      {amenities.length > 6 && (
        <div>
          <Button
            variant="secondary"
            className="inline-flex h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-6 text-sm font-medium text-slate-900 transition-all duration-200 ease-out hover:border-slate-300 hover:bg-slate-50 active:scale-[0.97]"
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
          <ul className="flex flex-wrap gap-2">
            {amenities.map((id) => {
              const Icon = AMENITY_ICONS[id];
              return (
                <li
                  key={id}
                  className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 gap-1.5"
                >
                  {Icon && <Icon className="h-4 w-4" strokeWidth={1.5} />}
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
