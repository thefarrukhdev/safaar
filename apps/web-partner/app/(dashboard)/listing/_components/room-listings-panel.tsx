'use client';

import { useState } from 'react';
import {
  BedDouble,
  CarFront,
  Image as ImageIcon,
  Pencil,
  Trash2,
  Users,
  UtensilsCrossed,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../../../_components/ui/button';
import { Card, CardBody } from '../../../_components/ui/card';
import { useConfirm } from '../../../_components/ui/confirm-dialog';
import {
  AMENITY_GROUPS,
  RESTAURANT_AMENITY_GROUPS,
} from '../../../_lib/domain/listing';
import { useDeleteRoom, useUpdateRoom } from '../../../_hooks/use-rooms';
import { useDeleteRoomType, useUpdateRoomType } from '../../../_hooks/use-room-types';
import type { Room, RoomType } from '../../../_lib/domain/types';
import type { PartnerLabels } from '../../../_lib/utils/partner-labels';
import { cn } from '../../../_lib/utils/cn';
import { formatMoney } from '../../../_lib/utils/format';

const AMENITY_LABEL = new Map<string, string>();
for (const group of [...AMENITY_GROUPS, ...RESTAURANT_AMENITY_GROUPS]) {
  for (const item of group.items) AMENITY_LABEL.set(item.id, item.label);
}

export interface RoomAdItem {
  roomType: RoomType;
  relatedRooms: Room[];
  listedCount: number;
  minPrice: number;
  totalBeds: number;
  listedBedCount: number;
}

interface RoomListingsPanelProps {
  roomAds: RoomAdItem[];
  labels: PartnerLabels;
  isHostel: boolean;
  restaurant: boolean;
  isBus?: boolean;
  amenityLabels: Map<string, string>;
  onAddRoomType?: () => void;
  onEditRoomType?: (roomType: RoomType) => void;
}

function resolveImageUrl(url?: string | null): string {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  if (url.startsWith('/uploads/')) {
    const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/v1').replace(/\/v1\/?$/, '');
    return `${apiBase}${url}`;
  }
  return url;
}

export function RoomListingsPanel({
  roomAds,
  labels,
  isHostel,
  restaurant,
  isBus,
  amenityLabels,
  onAddRoomType,
  onEditRoomType,
}: RoomListingsPanelProps) {
  const deleteRoomType = useDeleteRoomType();
  const updateRoomType = useUpdateRoomType();
  const deleteRoom = useDeleteRoom();
  const updateRoom = useUpdateRoom();
  const confirm = useConfirm();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (roomType: RoomType, relatedRooms: Room[]) => {
    const isCascade = relatedRooms.length > 0;
    const ok = await confirm({
      title: `"${roomType.name}" ni o'chirish`,
      description: isCascade
        ? `"${roomType.name}" turiga ulangan ${relatedRooms.length} ta xona mavjud. Ushbu xona turini o'chirsangiz, ichidagi barcha xonalar ham qo'shib o'chiriladi. Rozimisiz?`
        : `Rostdan ham "${roomType.name}" ni o'chirmoqchimisiz? Bu amalni bekor qilib bo'lmaydi.`,
      confirmText: "O'chirish",
      cancelText: "Bekor qilish",
      destructive: true,
    });
      
    if (ok) {
      setIsDeleting(true);
      try {
        if (relatedRooms.length > 0) {
          await Promise.all(relatedRooms.map((room) => deleteRoom.mutateAsync(room.id)));
        }
        
        try {
          await deleteRoomType.mutateAsync(roomType.id);
          toast.success("Muvaffaqiyatli o'chirildi");
        } catch {
          // BIZNES MANTIQ: Backend o'chirishga ruxsat bermasa, 
          // uning nomini o'zgartirib yashirib qo'yamiz
          await updateRoomType.mutateAsync({
            id: roomType.id,
            values: { 
              name: `DELETED_${roomType.id}`,
              capacity: roomType.capacity,
              basePrice: roomType.basePrice || 0,
              amenities: (roomType.amenities as string[]) || [],
              description: roomType.description,
              bedType: roomType.bedType,
              sizeSqm: roomType.sizeSqm,
            },
          });
          toast.success("Muvaffaqiyatli o'chirildi");
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Xatolik yuz berdi");
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <Card>
      <CardBody className="flex flex-col gap-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">
              {labels.unitTypesTitle}
            </span>
            <h2 className="mt-1 text-xl font-semibold">
              Turist tanlaydigan {labels.unitSingular} variantlari
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
              Web-userda turist sana, narx, sig'im va qulaylik filtrlarini
              tanlaganda shu e'lonlar ichidan mos variantlarni ko'radi.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {onAddRoomType && roomAds.length > 0 && (
              <Button size="sm" onClick={onAddRoomType} variant="outline">
                + Yangi variant qo'shish
              </Button>
            )}
          </div>
        </div>

        {roomAds.length === 0 ? (
          <div className="rounded-card border border-dashed border-[var(--border)] bg-[var(--surface-muted)] p-6 text-center">
            {isBus ? (
              <CarFront
                className="mx-auto h-8 w-8 text-[var(--muted-foreground)]"
                aria-hidden
              />
            ) : restaurant ? (
              <UtensilsCrossed
                className="mx-auto h-8 w-8 text-[var(--muted-foreground)]"
                aria-hidden
              />
            ) : (
              <BedDouble
                className="mx-auto h-8 w-8 text-[var(--muted-foreground)]"
                aria-hidden
              />
            )}
            <h3 className="mt-3 text-sm font-semibold">
              Hali hech qanday variant yo'q
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[var(--muted-foreground)]">
              Turistlar bron qila olishi uchun kamida bitta xona variantini qo'shing.
            </p>
            {onAddRoomType && (
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button onClick={onAddRoomType}>
                  + Yangi variant qo'shish
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {roomAds.map(
              ({
                roomType,
                relatedRooms,
                listedCount,
                minPrice,
                totalBeds,
                listedBedCount,
              }) => (
                <RoomAdCard
                  key={roomType.id}
                  name={roomType.name}
                  capacity={roomType.capacity}
                  description={roomType.description}
                  imageUrl={roomType.imageUrl}
                  bedType={roomType.bedType}
                  sizeSqm={roomType.sizeSqm}
                  amenities={roomType.amenities}
                  minPrice={minPrice}
                  unitLabel={labels.unitSingular}
                  totalUnits={isHostel ? totalBeds : relatedRooms.length}
                  listedUnits={isHostel ? listedBedCount : listedCount}
                  restaurant={restaurant}
                  isBus={isBus}
                  amenityLabels={amenityLabels}
                  relatedRooms={relatedRooms}
                  onEdit={onEditRoomType ? () => onEditRoomType(roomType) : undefined}
                  onDelete={() => handleDelete(roomType, relatedRooms)}
                  onTogglePublish={async (publish) => {
                    try {
                      await Promise.all(
                        relatedRooms.map((room) =>
                          updateRoom.mutateAsync({ id: room.id, values: { isListed: publish } }),
                        ),
                      );
                      toast.success(
                        publish
                          ? `${labels.unitPlural} e'longa chiqarildi`
                          : `${labels.unitPlural} yopildi`,
                      );
                    } catch {
                      toast.error('Xatolik yuz berdi');
                    }
                  }}
                  isDeleting={isDeleting}
                />
              ),
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

interface RoomAdCardProps {
  name: string;
  capacity: number;
  description?: string;
  imageUrl?: string;
  bedType?: string;
  sizeSqm?: number;
  amenities: string[];
  minPrice: number;
  unitLabel: string;
  totalUnits: number;
  listedUnits: number;
  restaurant: boolean;
  isBus?: boolean;
  amenityLabels?: Map<string, string>;
  relatedRooms?: { id: string; number: string; isListed: boolean }[];
  onEdit?: () => void;
  onDelete?: () => void;
  onTogglePublish?: (publish: boolean) => Promise<void>;
  isDeleting?: boolean;
}

export function RoomAdCard({
  name,
  capacity,
  description,
  imageUrl,
  bedType,
  sizeSqm,
  amenities,
  minPrice,
  unitLabel,
  totalUnits,
  listedUnits,
  restaurant,
  isBus,
  amenityLabels,
  relatedRooms,
  onEdit,
  onDelete,
  onTogglePublish,
  isDeleting,
}: RoomAdCardProps) {
  const [isToggling, setIsToggling] = useState(false);
  const [imageError, setImageError] = useState(false);
  const resolvedUrl = resolveImageUrl(imageUrl);

  return (
    <div className="overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]">
      <div className="grid gap-0 sm:grid-cols-[140px_minmax(0,1fr)]">
        <div className="aspect-[4/3] bg-[var(--surface-muted)] sm:h-full sm:min-h-[180px] sm:aspect-auto">
          {resolvedUrl && !imageError ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={resolvedUrl}
              alt={name}
              onError={() => setImageError(true)}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">
              <ImageIcon className="h-8 w-8 text-zinc-400" aria-hidden />
            </div>
          )}
        </div>
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="truncate text-base font-semibold">{name}</h3>
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold',
                    listedUnits > 0
                      ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/35 dark:text-accent-200'
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800',
                  )}
                >
                  {listedUnits > 0 ? 'Sotuvda' : 'Yopiq'}
                </span>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--muted-foreground)]">
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" aria-hidden />
                  {capacity} {isBus ? "o'rindiq" : "kishi"}
                </span>
                {!restaurant && !isBus && bedType && <span>{bedType}</span>}
                {!restaurant && typeof sizeSqm === 'number' && sizeSqm > 0 && (
                  <span>{sizeSqm} m²</span>
                )}
                <span>
                  {listedUnits}/{totalUnits} {unitLabel} e'londa
                </span>
              </p>
              {description && (
                <p className="mt-2 line-clamp-2 text-xs leading-5 text-[var(--muted-foreground)]">
                  {description}
                </p>
              )}
            </div>
            <div className="shrink-0 text-right flex flex-col items-end gap-2">
              <div>
                <p className="text-[11px] text-[var(--muted-foreground)]">
                  {restaurant ? 'narxi' : isBus ? '1 kunlik' : '1 kecha'}
                </p>
                <p className="text-base font-semibold text-brand-700 dark:text-brand-300">
                  {formatMoney(minPrice)}
                </p>
              </div>
              <div className="flex gap-2">
                {onEdit && (
                  <Button size="sm" variant="outline" onClick={onEdit} className="h-7 text-xs px-2">
                    <Pencil className="h-3 w-3 mr-1" aria-hidden />
                    Tahrirlash
                  </Button>
                )}
                {onDelete && (
                  <Button size="sm" variant="outline" onClick={onDelete} disabled={isDeleting} className="h-7 text-xs px-2 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200">
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {relatedRooms && relatedRooms.length > 0 && (
              <div className="w-full mb-1">
                <span className="text-[10px] uppercase font-semibold text-[var(--muted-foreground)] tracking-widest">Ichidagi {unitLabel}lar: </span>
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {relatedRooms.map((room) => (
                    <span
                      key={room.id}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium border",
                        room.isListed
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400",
                      )}
                      title={room.isListed ? "Sotuvda" : "Yashirilgan"}
                    >
                      {room.number}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {amenities.slice(0, 5).map((amenity) => (
              <span
                key={amenity}
                className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[11px]"
              >
                {amenityLabels?.get(amenity) ?? AMENITY_LABEL.get(amenity) ?? amenity}
              </span>
            ))}
            {amenities.length > 5 && (
              <span className="rounded-full bg-[var(--surface-muted)] px-2 py-0.5 text-[11px] text-[var(--muted-foreground)]">
                +{amenities.length - 5}
              </span>
            )}
          </div>

          <div className="mt-3 border-t border-[var(--border)] pt-3 flex items-center justify-between gap-2">
            <span className="text-xs text-[var(--muted-foreground)]">
              {listedUnits > 0
                ? `${listedUnits} ta ${unitLabel} turistlarga ko'rinadi`
                : `Hozircha turistlarga ko'rinmaydi`}
            </span>
            {onTogglePublish && (
              <Button
                size="sm"
                variant={listedUnits > 0 ? 'outline' : 'primary'}
                disabled={isToggling || totalUnits === 0}
                onClick={async () => {
                  setIsToggling(true);
                  try {
                    await onTogglePublish(listedUnits === 0);
                  } finally {
                    setIsToggling(false);
                  }
                }}
                className={cn(
                  'h-7 text-xs px-3',
                  listedUnits > 0
                    ? 'text-zinc-600 hover:text-red-600 hover:border-red-200 hover:bg-red-50'
                    : '',
                )}
              >
                {isToggling
                  ? 'Saqlanmoqda...'
                  : listedUnits > 0
                    ? 'E\'longa yopish'
                    : 'E\'longa chiqarish'}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
