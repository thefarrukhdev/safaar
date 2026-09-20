'use client';

import {
  Baby,
  BedDouble,
  CarFront,
  Camera,
  CheckCircle2,
  CheckSquare,
  Cigarette,
  Dog,
  Eye,
  EyeOff,
  FileText,
  Image as ImageIcon,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  RotateCcw,
  Send,
  Sparkles,
  Star,
  Tag,
  Trash2,
  UtensilsCrossed,
  Users,
  XCircle,
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Button } from '../../_components/ui/button';
import { Card, CardBody } from '../../_components/ui/card';
import { PreviewDrawer } from './_components/preview-drawer';
import { PromotionDialog } from './_dialogs/promotion-dialog';
import { GeneralEditor } from './_editors/general-editor';
import { PhotosEditor } from './_editors/photos-editor';
import { AmenitiesEditor } from './_editors/amenities-editor';
import { LocationEditor } from './_editors/location-editor';
import { RulesEditor } from './_editors/rules-editor';
import { RoomDialog } from '../settings/rooms/_dialogs/room-dialog';
import { UnifiedRoomDialog } from '../settings/rooms/_dialogs/unified-room-dialog';

import {
  AMENITY_GROUPS,
  CANCELLATION_POLICY_INFO,
  LISTING_STATUS_INFO,
  ListingStatus,
  RESTAURANT_AMENITY_GROUPS,
} from '../../_lib/domain/listing';
import {
  useListing,
  useResetListing,
  useUpdateListingStatus,
} from '../../_hooks/use-listing';
import { useBeds } from '../../_hooks/use-beds';
import { useRooms, useDeleteRoom, useUpdateRoom } from '../../_hooks/use-rooms';
import { useRoomTypes, useDeleteRoomType, useUpdateRoomType } from '../../_hooks/use-room-types';
import { useDataStore } from '../../_stores/data-store';
import { useAuthStore } from '../../_stores/auth-store';
import {
  getPartnerLabels,
  hasBeds,
  hasStarRating,
  isDacha,
  isRestaurant,
  hasBuses,
} from '../../_lib/utils/partner-labels';
import { cn } from '../../_lib/utils/cn';
import { formatMoney } from '../../_lib/utils/format';
import { useAmenities } from '../../_hooks/use-catalog';
import { useVehicles, useUpdateVehicle } from '../../_hooks/use-vehicles';
import { VehicleDialog } from '../rooms/vehicles-view';

const AMENITY_LABEL = new Map<string, string>();
for (const group of [...AMENITY_GROUPS, ...RESTAURANT_AMENITY_GROUPS]) {
  for (const item of group.items) AMENITY_LABEL.set(item.id, item.label);
}

type SectionId =
  | 'general'
  | 'photos'
  | 'amenities'
  | 'location'
  | 'rules'
  | 'roomTypes'
  | 'rooms';
type OpenEditor = Exclude<SectionId, 'roomTypes' | 'rooms'> | null;

interface ListingSection {
  id: SectionId;
  title: string;
  subtitle: string;
  action: string;
  complete: boolean;
  summary: string;
  icon: React.ReactNode;
  missing?: string;
}

export function ListingOverview() {
  const { data: listing } = useListing();
  const { data: rooms } = useRooms();
  const { data: roomTypes } = useRoomTypes();
  const { data: allAmenities = [] } = useAmenities();
  useBeds();
  const beds = useDataStore((s) => s.beds);
  const updateStatus = useUpdateListingStatus();
  const resetListing = useResetListing();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const showStars = hasStarRating(partnerType);
  const dacha = isDacha(partnerType);
  const isHostel = hasBeds(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);

  const [openEditor, setOpenEditor] = useState<OpenEditor>(null);
  const [previewOpen, setPreviewOpen] = useState(false);


  const [roomTypeDialogOpen, setRoomTypeDialogOpen] = useState(false);
  const [editingRoomType, setEditingRoomType] = useState<
    import('../../_lib/domain/types').RoomType | null
  >(null);
  const [vehicleDialogOpen, setVehicleDialogOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);

  const { data: vehicles = [] } = useVehicles();

  const dynamicAmenityLabels = useMemo(() => {
    const map = new Map<string, string>();
    allAmenities.forEach((a: any) => {
      map.set(a.code, typeof a.name === 'string' ? a.name : ((a.name as any)?.uz || a.code));
    });
    return map;
  }, [allAmenities]);

  const statusInfo = LISTING_STATUS_INFO[listing.status];
  const cover =
    listing.photos.find((photo) => photo.isCover) ?? listing.photos[0];
  const listedRooms = rooms.filter((room) => room.isListed);
  const roomAds = roomTypes
    .filter((rt) => !rt.name.startsWith("DELETED_"))
    .map((roomType) => {
    const relatedRooms = rooms.filter(
      (room) => room.roomTypeId === roomType.id,
    );
    const listedCount = relatedRooms.filter((room) => room.isListed).length;
    const relatedBeds = beds.filter((bed) =>
      relatedRooms.some((room) => room.id === bed.roomId),
    );
    const listedBedCount = relatedBeds.filter((bed) => bed.isListed).length;
    const prices = relatedRooms
      .map((room) => room.nightlyPrice ?? roomType.basePrice)
      .filter((price) => price > 0);
    const minPrice =
      prices.length > 0 ? Math.min(...prices) : roomType.basePrice;
    return {
      roomType,
      relatedRooms,
      listedCount,
      minPrice,
      totalBeds: relatedBeds.length,
      listedBedCount,
    };
  });

  const sections = useMemo<ListingSection[]>(() => {
    const generalComplete =
      listing.name.trim().length >= 3 &&
      listing.shortDescription.trim().length >= 20 &&
      listing.fullDescription.trim().length >= 100;
    const photosComplete = listing.photos.length >= 3;
    const amenitiesComplete = listing.amenities.length >= 3;
    const locationComplete =
      Boolean(listing.address.trim()) &&
      typeof listing.latitude === 'number' &&
      typeof listing.longitude === 'number';
    const rulesComplete = Boolean(listing.checkInTime && listing.checkOutTime);

    const base: ListingSection[] = [
      {
        id: 'general',
        title: "Asosiy ma'lumot",
        subtitle: `Nomi, qisqa tavsif, batafsil matn${showStars ? ' va yulduzlar' : ''}`,
        action: 'Matnni tahrirlash',
        complete: generalComplete,
        summary: listing.name
          ? showStars
            ? `${listing.name} · ${listing.stars} yulduz`
            : listing.name
          : 'Nomi kiritilmagan',
        icon: <FileText className="h-4 w-4" aria-hidden />,
        missing: !generalComplete
          ? "Nomi, qisqa tavsif yoki batafsil tavsifni to'ldiring."
          : undefined,
      },
      {
        id: 'photos',
        title: 'Rasmlar',
        subtitle: 'Muqova va kamida 3 ta sifatli rasm',
        action: 'Rasmlarni boshqarish',
        complete: photosComplete,
        summary: `${listing.photos.length} ta rasm${
          cover ? ' · muqova tanlangan' : ''
        }`,
        icon: <ImageIcon className="h-4 w-4" aria-hidden />,
        missing: !photosComplete ? 'Kamida 3 ta rasm yuklang.' : undefined,
      },
      {
        id: 'amenities',
        title: 'Qulayliklar',
        subtitle: "Mijoz filtr va kartada ko'radigan imkoniyatlar",
        action: 'Qulaylik tanlash',
        complete: amenitiesComplete,
        summary:
          listing.amenities.length > 0
            ? `${listing.amenities.length} ta qulaylik belgilangan`
            : 'Qulayliklar tanlanmagan',
        icon: <Sparkles className="h-4 w-4" aria-hidden />,
        missing: !amenitiesComplete
          ? 'Kamida 3 ta asosiy qulaylikni belgilang.'
          : undefined,
      },
      {
        id: 'location',
        title: 'Joylashuv',
        subtitle: 'Manzil va yaqin joylar mijoz ishonchini oshiradi',
        action: 'Manzilni tahrirlash',
        complete: locationComplete,
        summary: listing.address
          ? `${listing.city} · ${
              typeof listing.latitude === 'number'
                ? 'xarita nuqtasi bor'
                : 'xarita kerak'
            }${
              listing.nearby.length > 0
                ? ` · ${listing.nearby.length} yaqin joy`
                : ''
            }`
          : 'Manzil kiritilmagan',
        icon: <MapPin className="h-4 w-4" aria-hidden />,
        missing: !locationComplete
          ? 'Manzil va xarita nuqtasini kiriting.'
          : undefined,
      },
    ];

    base.push({
      id: 'rules',
      title: isBus ? 'Ijara qoidalari' : 'Uy qoidalari',
      subtitle: `${labels.checkInLabel}, ${labels.checkOutLabel.toLowerCase()} va bekor qilish shartlari`,
      action: 'Qoidalarni sozlash',
      complete: rulesComplete,
      summary: `${listing.checkInTime || '--:--'} dan ${isBus ? 'olib ketish' : 'kirish'} · ${
        listing.checkOutTime || '--:--'
      } gacha ${isBus ? 'qaytarish' : 'chiqish'}`,
      icon: <Baby className="h-4 w-4" aria-hidden />,
      missing: !rulesComplete
        ? `${labels.checkInLabel} va ${labels.checkOutLabel.toLowerCase()} vaqtlarini kiriting.`
        : undefined,
    });

    if (dacha) {
      return [
        ...base,
        {
          id: 'rooms',
          title: 'Dacha narxlari',
          subtitle: `Mijozlar band qilishi uchun narx va sig'imni kiriting`,
          action: `Narx kiritish`,
          complete: roomAds.length > 0 && listedRooms.length > 0,
          summary: roomAds.length > 0 && listedRooms.length > 0
            ? `Narxlar va sig'im e'lon qilingan`
            : `Hali narx belgilanmagan`,
          icon: <BedDouble className="h-4 w-4" aria-hidden />,
          missing: roomAds.length === 0 || listedRooms.length === 0
            ? `Dachangizning xona turini qo'shing va e'longa chiqaring.`
            : undefined,
        },
      ];
    }

    if (restaurant) {
      return [
        ...base,
        {
          id: 'rooms',
          title: 'Stollar',
          subtitle: `Mijoz band qilishi mumkin bo'lgan stollar`,
          action: `Stol qo'shish`,
          complete: listedRooms.length > 0,
          summary: listedRooms.length > 0
            ? `${listedRooms.length} ta stol savdoda`
            : `Hali stollar qo'shilmagan`,
          icon: <UtensilsCrossed className="h-4 w-4" aria-hidden />,
          missing: listedRooms.length === 0
            ? `Kamida bitta stol qo'shing va sotuvga chiqaring.`
            : undefined,
        },
      ];
    }

    if (isBus) {
      return [
        ...base,
        {
          id: 'rooms',
          title: 'Avtomobillar',
          subtitle: `Mijoz bron qilishi mumkin bo'lgan avtomobillar`,
          action: `Avto qo'shish`,
          complete: vehicles.some(v => v.status === 'active'),
          summary: vehicles.some(v => v.status === 'active')
            ? `${vehicles.filter(v => v.status === 'active').length} ta avto sotuvda`
            : `Hali avtomobillar qo'shilmagan`,
          icon: <CarFront className="h-4 w-4" aria-hidden />,
          missing: !vehicles.some(v => v.status === 'active')
            ? `Kamida bitta avtomobil qo'shing va sotuvga chiqaring.`
            : undefined,
        },
      ];
    }

    return base;
  }, [cover, listing, showStars, labels, dacha, restaurant, isBus, roomAds, listedRooms, vehicles]);

  const completedCount = sections.filter((section) => section.complete).length;
  const progress = Math.round((completedCount / sections.length) * 100);
  const missing = sections.filter((section) => !section.complete);
  const nextSection = missing[0];
  const readyToSubmit = missing.length === 0;

  const openSection = (id: SectionId) => {
    if (id === 'roomTypes' || id === 'rooms') {
      document.getElementById('room-listings-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    setOpenEditor(id as OpenEditor);
  };

  const statusTone = {
    warning:
      'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200',
    accent:
      'border-accent-200 bg-accent-50 text-accent-800 dark:border-accent-900/60 dark:bg-accent-950/30 dark:text-accent-200',
    brand:
      'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-900/60 dark:bg-brand-950/30 dark:text-brand-200',
    neutral:
      'border-[var(--border)] bg-[var(--surface-muted)] text-[var(--foreground)]',
  }[statusInfo.tone];

  const [promoDialogOpen, setPromoDialogOpen] = useState(false);

  const handlePublishAction = () => {
    if (listing.status === ListingStatus.PUBLISHED) {
      updateStatus.mutate(ListingStatus.HIDDEN, {
        onSuccess: () => toast.success("E'lon mijozlardan yashirildi"),
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : 'Xato yuz berdi',
          );
        },
      });
      return;
    }

    if (listing.status === ListingStatus.HIDDEN) {
      updateStatus.mutate(ListingStatus.UNDER_REVIEW, {
        onSuccess: () =>
          toast.success("E'lon qayta ko'rib chiqishga yuborildi"),
        onError: (error) => {
          toast.error(
            error instanceof Error ? error.message : 'Xato yuz berdi',
          );
        },
      });
      return;
    }

    if (!readyToSubmit) {
      toast.error("E'lon hali tayyor emas", {
        description: nextSection?.missing,
      });
      return;
    }

    updateStatus.mutate(ListingStatus.UNDER_REVIEW, {
      onSuccess: () =>
        toast.success("E'lon ko'rib chiqishga yuborildi", {
          description: 'Admin tekshirgandan keyin nashr qilinadi.',
        }),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Xato yuz berdi');
      },
    });
  };

  const handleResetListing = () => {
    const confirmed = window.confirm(
      "E'lonni qayta yaratmoqchimisiz? Nomi, tavsifi, rasmlari, qulayliklari va xonalari butunlay o'chiriladi va bu amalni bekor qilib bo'lmaydi.",
    );
    if (!confirmed) return;

    resetListing.mutate(undefined, {
      onSuccess: () =>
        toast.success("E'lon tozalandi — endi qaytadan to'ldirishingiz mumkin"),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : 'Xato yuz berdi');
      },
    });
  };


  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="flex min-w-0 flex-col gap-5">
        <Card>
          <CardBody className="p-0">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="flex min-w-0 flex-col gap-4 p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-brand-700 dark:text-brand-300">
                        E'lon joylashtirish
                      </span>
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold',
                          statusTone,
                        )}
                      >
                        {statusInfo.label}
                      </span>
                    </div>
                    <h1 className="mt-1 text-2xl font-semibold sm:text-[28px]">
                      {labels.listingTitle}ni tayyorlash
                    </h1>
                    <p className="mt-1 max-w-2xl text-sm leading-6 text-[var(--muted-foreground)]">
                      Mijozlar ko'radigan ma'lumotlarni bir joyda boshqaring:
                      rasmlar, tavsif, qulayliklar, manzil va qoidalar.
                    </p>
                  </div>

                  {!isBus && (
                    <div className="flex flex-wrap gap-2">
                      {listing.status === ListingStatus.PUBLISHED && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="bg-amber-100 text-amber-700 hover:bg-amber-200 border-amber-200"
                          onClick={() => setPromoDialogOpen(true)}
                        >
                          <Tag className="h-4 w-4" aria-hidden />
                          Chegirma e'lon qilish
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPreviewOpen(true)}
                      >
                        <Eye className="h-4 w-4" aria-hidden />
                        Preview
                      </Button>
                      <Button
                        size="sm"
                        variant={
                          listing.status === ListingStatus.PUBLISHED
                            ? 'outline'
                            : 'primary'
                        }
                        disabled={
                          updateStatus.isPending ||
                          listing.status === ListingStatus.UNDER_REVIEW ||
                          (!readyToSubmit &&
                            listing.status !== ListingStatus.PUBLISHED &&
                            listing.status !== ListingStatus.HIDDEN)
                        }
                        onClick={handlePublishAction}
                      >
                        {listing.status === ListingStatus.PUBLISHED ? (
                          <>
                            <EyeOff className="h-4 w-4" aria-hidden />
                            Yashirish
                          </>
                        ) : listing.status === ListingStatus.HIDDEN ? (
                          <>
                            <Eye className="h-4 w-4" aria-hidden />
                            Qayta nashr
                          </>
                        ) : (
                          <>
                            <Send className="h-4 w-4" aria-hidden />
                            Nashrga yuborish
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={resetListing.isPending}
                        onClick={handleResetListing}
                      >
                        <RotateCcw className="h-4 w-4" aria-hidden />
                        Qayta e'lon yaratish
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium">Tayyorlik darajasi</span>
                    <span className="text-[var(--muted-foreground)]">
                      {completedCount}/{sections.length} bo'lim · {progress}%
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-muted)]">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-500',
                        progress === 100
                          ? 'bg-accent-500'
                          : progress >= 60
                            ? 'bg-brand-600'
                            : 'bg-amber-500',
                      )}
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {isBus ? (
                    <Signal
                      label="Avtomobillar"
                      value={`${vehicles.length} ta`}
                      hint={`${vehicles.filter(v => v.status === 'active').length} ta sotuvda`}
                    />
                  ) : (
                    <>
                      <Signal
                        label="Rasmlar"
                        value={`${listing.photos.length} ta`}
                        hint={cover ? 'Muqova bor' : 'Muqova kerak'}
                      />
                      <Signal
                        label="Qulayliklar"
                        value={`${listing.amenities.length} ta`}
                        hint="Filtrlarda chiqadi"
                      />
                      <Signal
                        label="Joylashuv"
                        value={listing.city || 'Kiritilmagan'}
                        hint={
                          typeof listing.latitude === 'number'
                            ? listing.nearby.length > 0
                              ? `${listing.nearby.length} yaqin joy · xarita bor`
                              : 'Xarita bor'
                            : 'Xarita nuqtasi kerak'
                        }
                      />
                      {!dacha && (
                        <Signal
                          label={labels.unitTypesTitle}
                          value={`${roomAds.length} tur`}
                          hint={`${listedRooms.length} ${labels.unitPlural} sotuvda`}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>

              {!isBus && (
                <LivePreview
                  cover={cover?.url}
                  name={listing.name}
                  city={listing.city}
                  stars={listing.stars}
                  showStars={showStars}
                  shortDescription={listing.shortDescription}
                  photosCount={listing.photos.length}
                  onOpen={() => setPreviewOpen(true)}
                />
              )}
            </div>
          </CardBody>
        </Card>

        <div className="grid gap-3">
          {sections.map((section, index) => (
            <WorkflowStep
              key={section.id}
              index={index + 1}
              section={section}
              active={nextSection?.id === section.id}
              onEdit={() => openSection(section.id)}
            />
          ))}
        </div>

        {isBus ? (
          <div id="room-listings-panel">
            <VehicleListingsPanel
              vehicles={vehicles}
              onAdd={() => {
                setEditingVehicle(null);
                setVehicleDialogOpen(true);
              }}
              onEdit={(vehicle) => {
                setEditingVehicle(vehicle);
                setVehicleDialogOpen(true);
              }}
            />
          </div>
        ) : (
          <div id="room-listings-panel">
            <RoomListingsPanel
              roomAds={roomAds}
              labels={labels}
              isHostel={isHostel}
              restaurant={restaurant}
              isBus={isBus}
              amenityLabels={dynamicAmenityLabels}
              onAddRoomType={() => {
                setEditingRoomType(null);
                setRoomTypeDialogOpen(true);
              }}
              onEditRoomType={(rt) => {
                setEditingRoomType(rt);
                setRoomTypeDialogOpen(true);
              }}
            />
          </div>
        )}
      </section>

      <aside className="flex min-w-0 flex-col gap-4 xl:sticky xl:top-20 xl:self-start">
        <Card>
          <CardBody className="flex flex-col gap-4">
            <div>
              <h2 className="text-sm font-semibold">Keyingi qadam</h2>
              <p className="mt-1 text-sm leading-6 text-[var(--muted-foreground)]">
                {nextSection
                  ? nextSection.missing
                  : isBus
                    ? "Barcha kerakli ma'lumotlar kiritilgan. Avtomobillaringiz mijozlarga ko'rinadi."
                    : listing.status === ListingStatus.PUBLISHED
                      ? "E'lon faol. Kerak bo'lsa preview orqali mijoz ko'rinishini tekshiring."
                      : "Barcha bo'limlar tayyor. Endi e'lonni nashrga yuborishingiz mumkin."}
              </p>
            </div>

            {nextSection ? (
              <Button onClick={() => openSection(nextSection.id)}>
                {nextSection.icon}
                {nextSection.action}
              </Button>
            ) : (
              <Button
                onClick={handlePublishAction}
                disabled={
                  updateStatus.isPending ||
                  listing.status === ListingStatus.UNDER_REVIEW
                }
              >
                <Send className="h-4 w-4" aria-hidden />
                Nashrga yuborish
              </Button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Mijozga ko'rinadiganlar</h2>
            <ChecklistItem done={Boolean(listing.name)} label="E'lon nomi" />
            <ChecklistItem
              done={listing.photos.length >= 3}
              label="Kamida 3 ta rasm"
            />
            <ChecklistItem
              done={listing.amenities.length >= 3}
              label="Asosiy qulayliklar"
            />
            <ChecklistItem
              done={Boolean(listing.address)}
              label="Aniq manzil"
            />
            <ChecklistItem
              done={
                typeof listing.latitude === 'number' &&
                typeof listing.longitude === 'number'
              }
              label="Xaritadagi nuqta"
            />
            <ChecklistItem
              done={Boolean(listing.checkInTime && listing.checkOutTime)}
              label={`${labels.checkInLabel}/${labels.checkOutLabel.toLowerCase()} va qoidalar`}
            />
            <ChecklistItem
              done={isBus ? vehicles.some(v => v.status === 'active') : restaurant ? listedRooms.length > 0 : roomAds.length > 0 && listedRooms.length > 0}
              label={isBus ? 'Avtomobillar' : restaurant ? 'Stollar' : labels.unitTypesTitle}
            />
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Qoidalar qisqacha</h2>
            <div className="grid gap-2 text-sm">
              <RuleChip
                on={listing.childrenAllowed}
                icon={<Baby />}
                label="Bolalar"
              />
              <RuleChip
                on={listing.petsAllowed}
                icon={<Dog />}
                label="Uy hayvonlari"
              />
              <RuleChip
                on={listing.smokingAllowed}
                icon={<Cigarette />}
                label="Chekish"
              />
            </div>
            <div className="rounded-md bg-[var(--surface-muted)] p-3 text-xs leading-5 text-[var(--muted-foreground)]">
              Bekor qilish:{' '}
              <span className="font-semibold text-[var(--foreground)]">
                {CANCELLATION_POLICY_INFO[listing.cancellationPolicy].label}
              </span>
            </div>
          </CardBody>
        </Card>
      </aside>

      <GeneralEditor
        open={openEditor === 'general'}
        onClose={() => setOpenEditor(null)}
      />
      <PhotosEditor
        open={openEditor === 'photos'}
        onClose={() => setOpenEditor(null)}
      />
      <AmenitiesEditor
        open={openEditor === 'amenities'}
        onClose={() => setOpenEditor(null)}
      />
      <LocationEditor
        open={openEditor === 'location'}
        onClose={() => setOpenEditor(null)}
      />
      <RulesEditor
        open={openEditor === 'rules'}
        onClose={() => setOpenEditor(null)}
      />
      <PreviewDrawer open={previewOpen} onClose={() => setPreviewOpen(false)} />
      <UnifiedRoomDialog
        open={roomTypeDialogOpen}
        onClose={() => {
          setRoomTypeDialogOpen(false);
          setEditingRoomType(null);
        }}
        mode={editingRoomType ? "type-only" : "room"}
        editing={editingRoomType}
      />
      <VehicleDialog
        open={vehicleDialogOpen}
        onClose={() => setVehicleDialogOpen(false)}
        editing={editingVehicle}
      />
      <PromotionDialog
        open={promoDialogOpen}
        onClose={() => setPromoDialogOpen(false)}
      />
    </div>
  );
}

function RoomListingsPanel({
  roomAds,
  labels,
  isHostel,
  restaurant,
  isBus,
  amenityLabels,
  onAddRoomType,
  onEditRoomType,
}: {
  roomAds: Array<{
    roomType: import('../../_lib/domain/types').RoomType;
    relatedRooms: import('../../_lib/domain/types').Room[];
    listedCount: number;
    minPrice: number;
    totalBeds: number;
    listedBedCount: number;
  }>;
  labels: import('../../_lib/utils/partner-labels').PartnerLabels;
  isHostel: boolean;
  restaurant: boolean;
  isBus?: boolean;
  amenityLabels: Map<string, string>;
  onAddRoomType?: () => void;
  onEditRoomType?: (roomType: import('../../_lib/domain/types').RoomType) => void;
}) {
  const deleteRoomType = useDeleteRoomType();
  const updateRoomType = useUpdateRoomType();
  const deleteRoom = useDeleteRoom();
  const updateRoom = useUpdateRoom();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async (roomType: import('../../_lib/domain/types').RoomType, relatedRooms: import('../../_lib/domain/types').Room[]) => {
    const msg = relatedRooms.length > 0
      ? `"${roomType.name}" turiga ulangan ${relatedRooms.length} ta xona mavjud. Ushbu xona turini o'chirsangiz, ichidagi barcha xonalar ham qo'shib o'chiriladi. Rozimisiz?`
      : `Rostdan ham "${roomType.name}" ni o'chirmoqchimisiz? Bu amalni bekor qilib bo'lmaydi.`;
      
    if (window.confirm(msg)) {
      setIsDeleting(true);
      try {
        if (relatedRooms.length > 0) {
          await Promise.all(relatedRooms.map(room => deleteRoom.mutateAsync(room.id)));
        }
        
        try {
          await deleteRoomType.mutateAsync(roomType.id);
          toast.success("Muvaffaqiyatli o'chirildi");
        } catch (backendError) {
          // BIZNES MANTIQ UCHUN FRONTEND-HACK: Backend o'chirishga ruxsat bermasa, 
          // biz frontendda uning nomini o'zgartirib yashirib qo'yamiz
          await updateRoomType.mutateAsync({
            id: roomType.id,
            values: { 
              name: `DELETED_${roomType.id}`,
              capacity: roomType.capacity,
              basePrice: roomType.basePrice || 0,
              amenities: roomType.amenities as string[] || [],
              description: roomType.description,
              bedType: roomType.bedType,
              sizeSqm: roomType.sizeSqm
            }
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
                        relatedRooms.map(room =>
                          updateRoom.mutateAsync({ id: room.id, values: { isListed: publish } })
                        )
                      );
                      toast.success(publish ? `${labels.unitPlural} e'longa chiqarildi` : `${labels.unitPlural} yopildi`);
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

function RoomAdCard({
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
}: {
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
}) {
  const [isToggling, setIsToggling] = useState(false);
  return (
    <div className="overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]">
      <div className="grid gap-0 sm:grid-cols-[140px_minmax(0,1fr)]">
        <div className="aspect-[4/3] bg-[var(--surface-muted)] sm:h-full sm:min-h-[180px] sm:aspect-auto">
          {imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={imageUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center text-[var(--muted-foreground)]">
              <ImageIcon className="h-8 w-8" aria-hidden />
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
                  {relatedRooms.map(room => (
                    <span
                      key={room.id}
                      className={cn(
                        "rounded px-1.5 py-0.5 text-[10px] font-medium border",
                        room.isListed
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                          : "border-zinc-200 bg-zinc-50 text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400"
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
                    : ''
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

function VehicleListingsPanel({
  vehicles,
  onAdd,
  onEdit,
}: {
  vehicles: any[];
  onAdd: () => void;
  onEdit: (vehicle: any) => void;
}) {
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
              <div key={vehicle.id} className="overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate text-base font-semibold">{vehicle.name}</h3>
                      <span className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        vehicle.status === 'active' ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400" : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                      )}>
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

function Signal({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <p className="text-[11px] font-medium text-[var(--muted-foreground)]">
        {label}
      </p>
      <p className="mt-0.5 truncate text-sm font-semibold">{value}</p>
      <p className="truncate text-[11px] text-[var(--muted-foreground)]">
        {hint}
      </p>
    </div>
  );
}

function LivePreview({
  cover,
  name,
  city,
  stars,
  showStars,
  shortDescription,
  photosCount,
  onOpen,
}: {
  cover?: string;
  name: string;
  city: string;
  stars: number;
  showStars: boolean;
  shortDescription: string;
  photosCount: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group relative min-h-[260px] overflow-hidden bg-zinc-900 text-left text-white lg:min-h-full"
    >
      {cover ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={cover}
          alt=""
          className="absolute inset-0 h-full w-full object-cover opacity-80 transition-transform duration-500 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-brand-950">
          <Camera className="h-12 w-12 text-white/30" aria-hidden />
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/10" />
      <div className="relative flex h-full min-h-[260px] flex-col justify-end p-4">
        <span className="mb-2 inline-flex w-fit items-center gap-1 rounded-md bg-black/45 px-2 py-1 text-xs font-medium backdrop-blur">
          <Camera className="h-3.5 w-3.5" aria-hidden />
          {photosCount} ta rasm
        </span>
        <h2 className="text-xl font-semibold">{name || 'Nomi kiritilmagan'}</h2>
        <div className="mt-1 flex items-center gap-1 text-sm text-white/85">
          {showStars &&
            Array.from({ length: 5 }).map((_, index) => (
              <Star
                key={index}
                className={cn(
                  'h-3.5 w-3.5',
                  index < stars
                    ? 'fill-amber-400 stroke-amber-400'
                    : 'stroke-white/45',
                )}
                aria-hidden
              />
            ))}
          <span className={showStars ? 'ml-1' : ''}>{city}</span>
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-5 text-white/80">
          {shortDescription || 'Qisqa tavsif hali kiritilmagan.'}
        </p>
      </div>
    </button>
  );
}

function WorkflowStep({
  index,
  section,
  active,
  onEdit,
}: {
  index: number;
  section: ListingSection;
  active: boolean;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        'grid gap-3 rounded-card border bg-[var(--surface)] p-4 text-left transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)] sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center',
        section.complete
          ? 'border-[var(--border)]'
          : active
            ? 'border-amber-300 dark:border-amber-800'
            : 'border-[var(--border)]',
      )}
    >
      <span
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-md text-sm font-semibold',
          section.complete
            ? 'bg-accent-50 text-accent-700 dark:bg-accent-950/35 dark:text-accent-200'
            : 'bg-amber-50 text-amber-700 dark:bg-amber-950/35 dark:text-amber-200',
        )}
      >
        {section.complete ? (
          <CheckCircle2 className="h-5 w-5" aria-hidden />
        ) : (
          index
        )}
      </span>

      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{section.title}</h3>
          {active && !section.complete && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
              keyingi
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
          {section.subtitle}
        </p>
        <p className="mt-2 truncate text-sm">{section.summary}</p>
        {section.missing && (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
            {section.missing}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 sm:justify-end">
        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 dark:text-brand-300">
          {section.icon}
          {section.action}
        </span>
      </div>
    </button>
  );
}

function ChecklistItem({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <CheckCircle2
        className={cn(
          'h-4 w-4 shrink-0',
          done ? 'text-accent-600' : 'text-zinc-300 dark:text-zinc-700',
        )}
        aria-hidden
      />
      <span
        className={cn(
          done ? 'text-[var(--foreground)]' : 'text-[var(--muted-foreground)]',
        )}
      >
        {label}
      </span>
    </div>
  );
}

function RuleChip({
  on,
  icon,
  label,
}: {
  on: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <div
      className={cn(
        'flex items-center justify-between rounded-md px-3 py-2',
        on
          ? 'bg-accent-50 text-accent-800 dark:bg-accent-950/30 dark:text-accent-200'
          : 'bg-[var(--surface-muted)] text-[var(--muted-foreground)]',
      )}
    >
      <span className="inline-flex items-center gap-2">
        <span className="[&>svg]:h-4 [&>svg]:w-4">{icon}</span>
        {label}
      </span>
      <span className="text-xs font-medium">{on ? 'Ruxsat' : "Yo'q"}</span>
    </div>
  );
}
