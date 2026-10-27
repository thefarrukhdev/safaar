"use client";

import {
  BedDouble,
  Calendar,
  CarFront,
  ExternalLink,
  Image as ImageIcon,
  MapPin,
  Star,
  UtensilsCrossed,
  Users,
} from "lucide-react";
import { Button } from "../../../_components/ui/button";
import { Drawer } from "../../../_components/ui/drawer";
import { AMENITY_GROUPS, RESTAURANT_AMENITY_GROUPS } from "../../../_lib/domain/listing";
import { useListing } from "../../../_hooks/use-listing";
import { useRooms } from "../../../_hooks/use-rooms";
import { useRoomTypes } from "../../../_hooks/use-room-types";
import { useAuthStore } from "../../../_stores/auth-store";
import { getPartnerLabels, hasBuses, hasStarRating, isRestaurant, isDacha } from "../../../_lib/utils/partner-labels";
import { cn } from "../../../_lib/utils/cn";
import { formatMoney } from "../../../_lib/utils/format";

// Amenities'ni label'ga aylantirish uchun map (barcha turlar birlashtirilgan)
const AMENITY_LABEL = new Map<string, string>();
for (const g of [...AMENITY_GROUPS, ...RESTAURANT_AMENITY_GROUPS]) {
  for (const it of g.items) AMENITY_LABEL.set(it.id, it.label);
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

export function PreviewDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { data: l } = useListing();
  const { data: rooms } = useRooms();
  const { data: roomTypes } = useRoomTypes();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const showStars = hasStarRating(partnerType);
  const restaurant = isRestaurant(partnerType);
  const dacha = isDacha(partnerType);
  const isBus = hasBuses(partnerType);
  const cover = l.photos.find((p) => p.isCover) ?? l.photos[0];
  const otherPhotos = l.photos.filter((p) => !p.isCover).slice(0, 4);
  const roomAds = roomTypes.map((roomType) => {
    const relatedRooms = rooms.filter((room) => room.roomTypeId === roomType.id);
    const listedRooms = relatedRooms.filter((room) => room.isListed);
    const prices = relatedRooms.map(
      (room) => room.nightlyPrice ?? roomType.basePrice,
    );
    return {
      roomType,
      listedCount: listedRooms.length,
      minPrice: prices.length > 0 ? Math.min(...prices) : roomType.basePrice,
    };
  });
  const mapUrl =
    typeof l.latitude === "number" && typeof l.longitude === "number"
      ? `https://www.google.com/maps?q=${l.latitude},${l.longitude}`
      : null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Mijoz nima ko'radi"
      description="Web-user saytida sizning e'loningiz shu tarzda ko'rinadi."
      size="xl"
      footer={<Button onClick={onClose}>Yopish</Button>}
    >
      <div className="flex flex-col gap-4">
        {/* Cover + gallery */}
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
          <div className="aspect-video overflow-hidden rounded-card bg-zinc-100 dark:bg-zinc-800">
            {cover ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={cover.url}
                alt=""
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-400">
                Rasm yo'q
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {otherPhotos.map((p) => (
              <div
                key={p.id}
                className="aspect-square overflow-hidden rounded-card bg-zinc-100 dark:bg-zinc-800"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
            ))}
            {Array.from({
              length: Math.max(0, 4 - otherPhotos.length),
            }).map((_, i) => (
              <div
                key={`ph-${i}`}
                className="aspect-square rounded-card border border-dashed border-[var(--border)]"
              />
            ))}
          </div>
        </div>

        {/* Header info */}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold tracking-tight">
            {l.name || "Nomi kiritilmagan"}
          </h1>
          <div className="flex items-center gap-2">
            {showStars && (
              <>
                <div className="inline-flex">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      className={cn(
                        "h-4 w-4",
                        n <= l.stars
                          ? "fill-amber-400 stroke-amber-500"
                          : "fill-transparent stroke-zinc-300",
                      )}
                      aria-hidden
                    />
                  ))}
                </div>
                <span className="text-sm text-[var(--muted-foreground)]">·</span>
              </>
            )}
            <span className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)]">
              <MapPin className="h-3.5 w-3.5" aria-hidden />
              {l.city} · {l.address}
            </span>
            {mapUrl && (
              <a
                href={mapUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                Xaritada
              </a>
            )}
          </div>
        </div>

        {/* Description */}
        {l.shortDescription && (
          <p className="rounded-card bg-brand-50/50 p-4 text-sm dark:bg-brand-900/20">
            {l.shortDescription}
          </p>
        )}

        {l.fullDescription && (
          <div className="flex flex-col gap-1.5">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Haqida
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed">
              {l.fullDescription}
            </p>
          </div>
        )}

        {roomAds.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              {labels.unitTypesTitle}
            </h2>
            <div className="grid gap-3">
              {roomAds.map(({ roomType, listedCount, minPrice }) => (
                <div
                  key={roomType.id}
                  className="overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)]"
                >
                  <div className="grid gap-0 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
                    <div className="aspect-[4/3] bg-[var(--surface-muted)] sm:h-full sm:aspect-auto">
                      {roomType.imageUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={resolveImageUrl(roomType.imageUrl)}
                          alt={roomType.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">
                          <ImageIcon className="h-8 w-8 text-zinc-400" aria-hidden />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {restaurant ? (
                          <UtensilsCrossed className="h-4 w-4 text-brand-600" aria-hidden />
                        ) : isBus ? (
                          <CarFront className="h-4 w-4 text-brand-600" aria-hidden />
                        ) : (
                          <BedDouble className="h-4 w-4 text-brand-600" aria-hidden />
                        )}
                        <h3 className="font-semibold">{roomType.name}</h3>
                        {listedCount <= 2 && listedCount > 0 && (
                          <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">
                            Faqat {listedCount} ta qoldi
                          </span>
                        )}
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" aria-hidden />
                          {roomType.capacity} {labels.capacitySuffix}
                        </span>
                        {!restaurant && roomType.bedType && <span>{roomType.bedType}</span>}
                        {!restaurant &&
                          typeof roomType.sizeSqm === "number" &&
                          roomType.sizeSqm > 0 && (
                            <span>{roomType.sizeSqm} m²</span>
                          )}
                        <span>{listedCount} {labels.unitSingular} mavjud</span>
                      </p>
                      {roomType.description && (
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[var(--muted-foreground)]">
                          {roomType.description}
                        </p>
                      )}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {roomType.amenities.slice(0, 4).map((amenity) => (
                          <span
                            key={amenity}
                            className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[11px]"
                          >
                            {AMENITY_LABEL.get(amenity) ?? amenity}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="border-t border-[var(--border)] p-4 text-left sm:border-l sm:border-t-0 sm:text-right">
                      <p className="text-[11px] text-[var(--muted-foreground)]">
                        {restaurant ? "depozit" : isBus ? "1 kunlik" : "1 kecha"}
                      </p>
                      <p className="text-lg font-bold text-brand-700 dark:text-brand-300">
                        {formatMoney(minPrice)}
                      </p>
                      <Button size="sm" className="mt-2">
                        Tanlash
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Amenities */}
        {l.amenities.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Qulayliklar
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {l.amenities.slice(0, 15).map((a) => (
                <span
                  key={a}
                  className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-1 text-xs"
                >
                  {AMENITY_LABEL.get(a) ?? a}
                </span>
              ))}
              {l.amenities.length > 15 && (
                <span className="rounded-full bg-[var(--surface-muted)] px-2.5 py-1 text-xs text-[var(--muted-foreground)]">
                  +{l.amenities.length - 15}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Nearby */}
        {l.nearby.length > 0 && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              Atrofda
            </h2>
            <ul className="flex flex-col divide-y divide-[var(--border)] rounded-card border border-[var(--border)]">
              {l.nearby.map((n) => (
                <li
                  key={n.id}
                  className="flex items-center justify-between px-4 py-2 text-sm"
                >
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5 text-brand-600" aria-hidden />
                    {n.name}
                  </span>
                  <span className="text-[var(--muted-foreground)]">
                    {n.distance}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* House rules */}
        {!isBus && (
          <div className="flex flex-col gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-[var(--muted-foreground)]">
              {restaurant ? "Restoran qoidalari" : isBus ? "Ijara qoidalari" : dacha ? "Dacha qoidalari" : "Uy qoidalari"}
            </h2>
            <div className="rounded-card border border-[var(--border)] p-4 text-sm">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-brand-600" aria-hidden />
                  {labels.checkInLabel}: <strong>{l.checkInTime}</strong>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4 text-brand-600" aria-hidden />
                  {labels.checkOutLabel}: <strong>{l.checkOutTime}</strong>
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <RuleChip on={l.childrenAllowed} label="Bolalar bilan mos" />
                <RuleChip on={l.petsAllowed} label="Uy hayvonlari" />
                <RuleChip on={l.smokingAllowed} label="Chekish" />
              </div>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function RuleChip({ on, label }: { on: boolean; label: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs",
        on
          ? "bg-accent-50 text-accent-700 dark:bg-accent-900/40 dark:text-accent-200"
          : "bg-zinc-100 text-zinc-500 line-through dark:bg-zinc-800 dark:text-zinc-500",
      )}
    >
      {label}
    </span>
  );
}
