'use client';

import {
  Baby,
  BedDouble,
  CarFront,
  Cigarette,
  Dog,
  Eye,
  EyeOff,
  FileText,
  Gem,
  Image as ImageIcon,
  MapPin,
  RotateCcw,
  Send,
  UtensilsCrossed,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '../../_components/ui/button';
import { Card, CardBody } from '../../_components/ui/card';
import { useConfirm } from '../../_components/ui/confirm-dialog';
import { PreviewDrawer } from './_components/preview-drawer';
import {
  WorkflowStep,
  type ListingSection,
  type SectionId,
} from './_components/workflow-step';
import { LivePreview } from './_components/live-preview';
import {
  ChecklistItem,
  RuleChip,
  Signal,
} from './_components/listing-checklist';
import { RoomListingsPanel } from './_components/room-listings-panel';
import { VehicleListingsPanel } from './_components/vehicle-listings-panel';

import { GeneralEditor } from './_editors/general-editor';
import { PhotosEditor } from './_editors/photos-editor';
import { AmenitiesEditor } from './_editors/amenities-editor';
import { LocationEditor } from './_editors/location-editor';
import { RulesEditor } from './_editors/rules-editor';
import { RoomTypeDialog } from '../rooms/_dialogs/room-type-dialog';
import { VehicleDialog } from '../rooms/vehicles-view';

import {
  CANCELLATION_POLICY_INFO,
  LISTING_STATUS_INFO,
  ListingStatus,
} from '../../_lib/domain/listing';
import {
  useListing,
  useResetListing,
  useUpdateListingStatus,
} from '../../_hooks/use-listing';
import { useBeds } from '../../_hooks/use-beds';
import { useRooms } from '../../_hooks/use-rooms';
import { useRoomTypes } from '../../_hooks/use-room-types';
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
import { useAmenities } from '../../_hooks/use-catalog';
import { useVehicles } from '../../_hooks/use-vehicles';

type OpenEditor = Exclude<SectionId, 'roomTypes' | 'rooms'> | null;

export function ListingOverview() {
  const { data: listing } = useListing();
  const { data: rooms } = useRooms();
  const { data: roomTypes } = useRoomTypes();
  const { data: allAmenities = [] } = useAmenities();
  const { data: beds = [] } = useBeds();
  const updateStatus = useUpdateListingStatus();
  const resetListing = useResetListing();
  const confirm = useConfirm();
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
      map.set(
        a.code,
        typeof a.name === 'string' ? a.name : ((a.name as any)?.uz || a.code),
      );
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
    const photosComplete = isBus
      ? listing.photos.length >= 0
      : listing.photos.length >= 3;
    const amenitiesComplete = isBus ? true : listing.amenities.length >= 3;
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
        subtitle: 'Muqova va rasm',
        action: 'Rasmlarni boshqarish',
        complete: photosComplete,
        summary: `${listing.photos.length} ta rasm${
          cover ? ' · muqova tanlangan' : ''
        }`,
        icon: <ImageIcon className="h-4 w-4" aria-hidden />,
        missing: !photosComplete ? 'Kamida 3 ta rasm yuklang.' : undefined,
      },
    ];

    if (!isBus) {
      base.push({
        id: 'amenities',
        title: 'Qulayliklar',
        subtitle: "Mijoz filtr va kartada ko'radigan imkoniyatlar",
        action: 'Qulaylik tanlash',
        complete: amenitiesComplete,
        summary:
          listing.amenities.length > 0
            ? `${listing.amenities.length} ta qulaylik belgilangan`
            : 'Qulayliklar tanlanmagan',
        icon: <Gem className="h-4 w-4" aria-hidden />,
        missing: !amenitiesComplete
          ? 'Kamida 3 ta asosiy qulaylikni belgilang.'
          : undefined,
      });
    }

    base.push({
      id: 'location',
      title: 'Joylashuv',
      subtitle: 'Manzil va xarita nuqtasi',
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
    });

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
          summary:
            roomAds.length > 0 && listedRooms.length > 0
              ? `Narxlar va sig'im e'lon qilingan`
              : `Hali narx belgilanmagan`,
          icon: <BedDouble className="h-4 w-4" aria-hidden />,
          missing:
            roomAds.length === 0 || listedRooms.length === 0
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
          summary:
            listedRooms.length > 0
              ? `${listedRooms.length} ta stol savdoda`
              : `Hali stollar qo'shilmagan`,
          icon: <UtensilsCrossed className="h-4 w-4" aria-hidden />,
          missing:
            listedRooms.length === 0
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
          complete: vehicles.some((v) => v.status === 'active'),
          summary: vehicles.some((v) => v.status === 'active')
            ? `${vehicles.filter((v) => v.status === 'active').length} ta avto sotuvda`
            : `Hali avtomobillar qo'shilmagan`,
          icon: <CarFront className="h-4 w-4" aria-hidden />,
          missing: !vehicles.some((v) => v.status === 'active')
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
      document
        .getElementById('room-listings-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const handleResetListing = async () => {
    const confirmed = await confirm({
      title: "E'lonni qayta yaratmoqchimisiz?",
      description:
        "Nomi, tavsifi, rasmlari, qulayliklari va xonalari butunlay o'chiriladi va bu amalni bekor qilib bo'lmaydi.",
      confirmText: "Qayta yaratish",
      cancelText: "Bekor qilish",
      destructive: true,
    });
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
                      hint={`${vehicles.filter((v) => v.status === 'active').length} ta sotuvda`}
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
                variant={listing.status === ListingStatus.PUBLISHED ? 'outline' : 'primary'}
                className={listing.status === ListingStatus.PUBLISHED ? 'w-full text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30' : 'w-full'}
              >
                {listing.status === ListingStatus.PUBLISHED ? (
                  <>
                    <EyeOff className="h-4 w-4 mr-2" aria-hidden />
                    E'lonni yashirish
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" aria-hidden />
                    Nashrga yuborish
                  </>
                )}
              </Button>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold">Mijozga ko'rinadiganlar</h2>
            <ChecklistItem done={Boolean(listing.name)} label="E'lon nomi" />
            <ChecklistItem
              done={isBus ? listing.photos.length >= 0 : listing.photos.length >= 3}
              label={isBus ? "Kamida 1 ta rasm (ixtiyoriy)" : "Kamida 3 ta rasm"}
            />
            {!isBus && (
              <ChecklistItem
                done={listing.amenities.length >= 3}
                label="Asosiy qulayliklar"
              />
            )}
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
              done={
                isBus
                  ? vehicles.some((v) => v.status === 'active')
                  : restaurant
                    ? listedRooms.length > 0
                    : roomAds.length > 0 && listedRooms.length > 0
              }
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
      <RoomTypeDialog
        open={roomTypeDialogOpen}
        onClose={() => {
          setRoomTypeDialogOpen(false);
          setEditingRoomType(null);
        }}
        editing={editingRoomType}
      />
      <VehicleDialog
        open={vehicleDialogOpen}
        onClose={() => setVehicleDialogOpen(false)}
        editing={editingVehicle}
      />
    </div>
  );
}
