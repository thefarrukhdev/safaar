"use client";

import {
  ArrowLeft,
  BedDouble,
  CalendarRange,
  Mail,
  Phone,
  Printer,
  StickyNote,
  User,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { BookingStatus } from "@safaar/types";
import { Button } from "../../../_components/ui/button";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "../../../_components/ui/card";
import { ConfirmDialog } from "../../../_components/ui/dialog";
import { EmptyState } from "../../../_components/ui/empty-state";
import { CheckInDialog } from "../../../_components/domain/check-in-dialog";
import { ReservationStatusBadge } from "../../../_components/domain/reservation-status-badge";
import { ReservationTimeline } from "../../../_components/domain/reservation-timeline";
import { SourceBadge } from "../../../_components/domain/source-badge";
import { PageHeader } from "../../../_components/layout/page-header";
import {
  useReservation,
  useConfirmReservation,
  useRejectReservation,
  useCheckIn,
  useCheckOut,
} from "../../../_hooks/use-reservations";
import { useBeds } from "../../../_hooks/use-beds";
import {
  formatDate,
  formatMoney,
  formatPhone,
} from "../../../_lib/utils/format";
import { useAuthStore } from "../../../_stores/auth-store";
import { useDataStore } from "../../../_stores/data-store";
import { useVehicles } from "../../../_hooks/use-vehicles";
import { getPartnerLabels, isRestaurant } from "../../../_lib/utils/partner-labels";

export function ReservationDetailView({ id }: { id: string }) {
  const { data } = useReservation(id);
  const confirmReservation = useConfirmReservation();
  const rejectReservation = useRejectReservation();
  const checkIn = useCheckIn();
  const checkOut = useCheckOut();
  useBeds();
  const beds = useDataStore((s) => s.beds);
  const { data: vehicles } = useVehicles();
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const restaurant = isRestaurant(partnerType);

  const [confirmDialog, setConfirmDialog] = useState<
    "reject" | "cancel" | null
  >(null);
  const [assignOpen, setAssignOpen] = useState(false);

  if (!data) {
    return (
      <EmptyState
        title="Bron topilmadi"
        description={`ID: ${id}`}
        action={
          <Link href="/reservations">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Bronlar ro'yxatiga
            </Button>
          </Link>
        }
      />
    );
  }

  const today = new Date().toISOString().split("T")[0];
  const isPastCheckIn = today > data.checkIn;
  const isPastCheckOut = today > data.checkOut;

  const balance = data.totalPrice - data.paidAmount;
  const canCheckIn = data.status === BookingStatus.CONFIRMED && !isPastCheckOut;
  const canCheckOut = data.status === "IN_HOUSE";
  const canConfirm = data.status === BookingStatus.PENDING && !isPastCheckIn;
  const canCancel =
    data.status === BookingStatus.CONFIRMED || data.status === "IN_HOUSE";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/reservations"
        className="inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        Bronlar ro'yxati
      </Link>

      <PageHeader
        eyebrow={`Bron ${data.id}`}
        title={data.guest.fullName}
        description={
          restaurant && data.slotTime
            ? `${formatDate(data.checkIn)} · ${data.slotTime}`
            : (partnerType === "bus" || partnerType === "BUS")
              ? `${formatDate(data.checkIn)} → ${formatDate(data.checkOut)} · ${data.nights} kun`
              : `${formatDate(data.checkIn)} → ${formatDate(data.checkOut)} · ${data.nights} kech.`
        }
        actions={
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.print()}
            >
              <Printer className="h-4 w-4" aria-hidden />
              Chop etish
            </Button>
            {canConfirm && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirmDialog("reject")}
                >
                  Rad etish
                </Button>
                <Button
                  size="sm"
                  loading={confirmReservation.isPending}
                  onClick={() => {
                    confirmReservation.mutate(data.id, {
                      onSuccess: () => toast.success("Bron tasdiqlandi"),
                    });
                  }}
                >
                  Tasdiqlash
                </Button>
              </>
            )}
            {canCheckIn && (
              <Button
                size="sm"
                onClick={() => setAssignOpen(true)}
              >
                {labels.checkInLabel}
              </Button>
            )}
            {canCheckOut && (
              <Button
                variant="secondary"
                size="sm"
                loading={checkOut.isPending}
                onClick={() => {
                  checkOut.mutate(data.id, {
                    onSuccess: () => toast.success(`${labels.checkOutLabel} qilindi`),
                  });
                }}
              >
                {labels.checkOutLabel}
              </Button>
            )}
            {canCancel && !canConfirm && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDialog("cancel")}
              >
                Bekor qilish
              </Button>
            )}
          </>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Bron tafsiloti</CardTitle>
              <div className="flex items-center gap-2">
                <SourceBadge source={data.source} />
                <ReservationStatusBadge status={data.status} />
              </div>
            </CardHeader>
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <InfoItem
                icon={restaurant ? <UtensilsCrossed className="h-4 w-4" aria-hidden /> : <BedDouble className="h-4 w-4" aria-hidden />}
                label={labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)}
                value={
                  labels.isBus && vehicles?.find((v) => v.id === data.roomTypeId) ? (
                    <>
                      {vehicles.find((v) => v.id === data.roomTypeId)?.name}
                      <span className="ml-1 font-mono text-brand-700 dark:text-brand-300">
                        · {vehicles.find((v) => v.id === data.roomTypeId)?.plateNumber}
                      </span>
                    </>
                  ) : (
                    <>
                      {data.roomTypeName}
                      {data.roomNumber && (
                        <span className="ml-1 font-mono text-brand-700 dark:text-brand-300">
                          · {data.roomNumber}
                          {data.bedId &&
                            ` · ${beds.find((b) => b.id === data.bedId)?.label ?? ""}`}
                        </span>
                      )}
                    </>
                  )
                }
              />
              <InfoItem
                icon={<User className="h-4 w-4" aria-hidden />}
                label={restaurant ? "Kishilar soni" : "Mehmonlar"}
                value={
                  restaurant
                    ? `${data.adults} kishi`
                    : `${data.adults} kattalar${data.children > 0 ? `, ${data.children} bola` : ""}`
                }
              />
              <InfoItem
                icon={<CalendarRange className="h-4 w-4" aria-hidden />}
                label="Kelish"
                value={
                  restaurant && data.slotTime
                    ? `${formatDate(data.checkIn)} · ${data.slotTime}`
                    : formatDate(data.checkIn)
                }
              />
              {!restaurant && (
                <InfoItem
                  icon={<CalendarRange className="h-4 w-4" aria-hidden />}
                  label={(partnerType === "bus" || partnerType === "BUS") ? "Qaytarish" : "Ketish"}
                  value={(partnerType === "bus" || partnerType === "BUS") 
                    ? `${formatDate(data.checkOut)} (${data.nights} kun)`
                    : `${formatDate(data.checkOut)} (${data.nights} kech.)`}
                />
              )}
              {data.specialRequests && (
                <InfoItem
                  icon={<StickyNote className="h-4 w-4" aria-hidden />}
                  label="Maxsus iltimos"
                  value={data.specialRequests}
                  className="sm:col-span-2"
                />
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Mijoz</CardTitle>
            </CardHeader>
            <CardBody className="grid gap-4 sm:grid-cols-2">
              <InfoItem
                icon={<User className="h-4 w-4" aria-hidden />}
                label="Ism"
                value={data.guest.fullName}
              />
              <InfoItem
                icon={<Phone className="h-4 w-4" aria-hidden />}
                label="Telefon"
                value={
                  <a
                    href={data.guest.phone.startsWith("+") ? `tel:${data.guest.phone}` : `tel:+${data.guest.phone}`}
                    className="text-brand-700 hover:underline dark:text-brand-300"
                  >
                    {formatPhone(data.guest.phone)}
                  </a>
                }
              />
              {data.guest.email && (
                <InfoItem
                  icon={<Mail className="h-4 w-4" aria-hidden />}
                  label="Email"
                  value={data.guest.email}
                />
              )}
              {data.guest.document && (
                <InfoItem
                  icon={<StickyNote className="h-4 w-4" aria-hidden />}
                  label="Hujjat"
                  value={data.guest.document}
                />
              )}
            </CardBody>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-4 w-4" aria-hidden />
              Moliya
            </CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-3">
            <FinanceRow label="Jami summa" value={formatMoney(data.totalPrice)} />
            <FinanceRow
              label="To'langan"
              value={formatMoney(data.paidAmount)}
              tone={data.paidAmount > 0 ? "accent" : "muted"}
            />
            <div className="my-1 h-px bg-[var(--border)]" />
            <FinanceRow
              label="Qoldiq"
              value={formatMoney(balance)}
              tone={balance > 0 ? "danger" : "accent"}
              bold
            />
            {balance > 0 && (
              <Button
                variant="secondary"
                className="mt-2"
                onClick={() => toast.info("To'lov modul keyingi sprint'da")}
              >
                To'lov qabul qilish
              </Button>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Jarayon</CardTitle>
        </CardHeader>
        <CardBody>
          <ReservationTimeline reservation={data} />
        </CardBody>
      </Card>

      <ConfirmDialog
        open={confirmDialog === "reject"}
        onClose={() => setConfirmDialog(null)}
        onConfirm={() => {
          rejectReservation.mutate(
            { id: data.id, reason: "Hamkor tomonidan rad etildi" },
            { onSuccess: () => toast.success("Bron rad etildi") }
          );
          setConfirmDialog(null);
        }}
        title="Bron rad etilsinmi?"
        description={`${data.guest.fullName} ning bronini rad etmoqchimisiz?`}
        confirmLabel="Ha, rad etish"
        tone="danger"
      />

      <ConfirmDialog
        open={confirmDialog === "cancel"}
        onClose={() => setConfirmDialog(null)}
        onConfirm={() => {
          rejectReservation.mutate(
            { id: data.id, reason: "Hamkor tomonidan bekor qilindi" },
            { onSuccess: () => toast.success("Bron bekor qilindi") }
          );
          setConfirmDialog(null);
        }}
        title="Bron bekor qilinsinmi?"
        description="Mijozga SMS orqali xabar yuboriladi. Bu amalni qaytarib bo'lmaydi."
        confirmLabel="Ha, bekor qilish"
        tone="danger"
      />

      <CheckInDialog
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        reservation={data}
        onAssigned={() => {
          checkIn.mutate(data.id, {
            onSuccess: () => toast.success(`${labels.checkInLabel} qilindi`),
          });
        }}
      />
    </div>
  );
}

function InfoItem({
  icon,
  label,
  value,
  className,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="flex items-center gap-1.5 text-xs text-[var(--muted-foreground)]">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function FinanceRow({
  label,
  value,
  tone = "muted",
  bold = false,
}: {
  label: string;
  value: string;
  tone?: "muted" | "accent" | "danger";
  bold?: boolean;
}) {
  const toneClass =
    tone === "accent"
      ? "text-accent-600"
      : tone === "danger"
        ? "text-red-600"
        : "";
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-[var(--muted-foreground)]">{label}</span>
      <span className={`${toneClass} ${bold ? "font-bold" : "font-medium"}`}>
        {value}
      </span>
    </div>
  );
}
