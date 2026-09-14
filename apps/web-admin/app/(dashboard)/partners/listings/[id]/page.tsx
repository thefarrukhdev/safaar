"use client";

import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import { CheckCircle2, XCircle, ArrowLeft, MapPin, Star, Building2, Users, Info, Wifi, Waves, Utensils, ParkingCircle, AirVent, Wine, Dumbbell, CalendarClock, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminApi } from "@/lib/api/admin-api";
import { extractApiErrorMessage } from "@/lib/utils";
import type { AdminListing } from "@/types/admin";

const MISSING_FIELD_LABELS: Record<string, string> = {
  general: "Asosiy ma'lumot (nomi, tavsif)",
  location: "Manzil va koordinatalar",
  media: "Rasmlar (kamida 3 ta)",
  amenities: "Qulayliklar (kamida 3 ta)",
  rules: "Uy qoidalari (check-in/check-out)",
  rooms: "Kamida 1 ta faol xona",
};

const LISTING_STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  under_review: { label: "Ko'rib chiqilmoqda", color: "#F39C12", bg: "rgba(243,156,18,0.12)" },
  published: { label: "Nashr qilingan", color: "#2ECC71", bg: "rgba(46,204,113,0.12)" },
  rejected: { label: "Rad etilgan", color: "#E74C3C", bg: "rgba(231,76,60,0.12)" },
};

const AMENITY_ICONS: Record<string, LucideIcon> = {
  wifi: Wifi,
  pool: Waves,
  restaurant: Utensils,
  parking: ParkingCircle,
  ac: AirVent,
  bar: Wine,
  spa: Waves,
  gym: Dumbbell,
};

export default function ListingDetailsPage() {
  const { id } = useParams();
  const router = useRouter();

  const listingId = Array.isArray(id) ? id[0] : id;
  const [listing, setListing] = useState<AdminListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [activePhoto, setActivePhoto] = useState(0);

  useEffect(() => {
    if (!listingId) return;
    AdminApi.getListing(listingId)
      .then((item) => setListing(item))
      .finally(() => setLoading(false));
  }, [listingId]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <span className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <h2 className="text-xl font-bold text-[var(--text-primary)]">E'lon topilmadi</h2>
        <Link href="/partners/listings" className="mt-4 text-[var(--primary)] hover:underline">
          Orqaga qaytish
        </Link>
      </div>
    );
  }

  const handleApprove = async () => {
    if (!confirm("Ushbu e'lonni tasdiqlab, nashr qilasizmi?")) return;
    try {
      await AdminApi.approveListing(listing.id);
      toast.success("E'lon muvaffaqiyatli tasdiqlandi va nashr etildi");
      router.push("/partners/listings");
    } catch (error) {
      toast.error(
        extractApiErrorMessage(error, "E'lonni tasdiqlab bo'lmadi. Qaytadan urinib ko'ring."),
      );
    }
  };

  const handleReject = async () => {
    const reason = window.prompt("Rad etish sababini kiriting:");
    if (reason === null) return;
    if (!reason.trim()) {
      toast.error("Rad etish sababini kiriting.");
      return;
    }
    try {
      await AdminApi.rejectListing(listing.id, reason.trim());
      toast.error("E'lon rad etildi");
      router.push("/partners/listings");
    } catch (error) {
      toast.error(
        extractApiErrorMessage(error, "E'lonni rad etib bo'lmadi. Qaytadan urinib ko'ring."),
      );
    }
  };

  return (
    <div className="max-w-[1000px] mx-auto flex flex-col gap-6 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/partners/listings"
            className="w-10 h-10 rounded-lg bg-[var(--bg-tertiary)] flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--border)] transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-[var(--text-primary)]">{listing.hotelName}</h1>
              <StatusBadge status={listing.status} statusMap={LISTING_STATUS_MAP} />
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-[var(--text-muted)]">
              <span className="flex items-center gap-1.5"><Building2 size={14} /> {listing.companyName}</span>
              <span className="flex items-center gap-1.5"><MapPin size={14} /> {listing.city}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Link href={`/partners/listings/${listing.id}/availability`}>
            <Button variant="secondary" icon={<CalendarClock size={16} />}>
              Availability
            </Button>
          </Link>
          <Link href={`/partners/listings/${listing.id}/edit`}>
            <Button variant="secondary" icon={<Info size={16} />}>
              Tahrirlash
            </Button>
          </Link>
          {listing.status === "under_review" && (
            <>
              <Button variant="secondary" className="text-[var(--danger)] border-[var(--danger)]/20 hover:bg-[var(--danger)]/5" icon={<XCircle size={16} />} onClick={handleReject}>
                Rad etish
              </Button>
              <Button className="bg-[var(--success)] hover:bg-[var(--success)]/90" icon={<CheckCircle2 size={16} />} onClick={handleApprove}>
                Tasdiqlash va Nashr qilish
              </Button>
            </>
          )}
        </div>
      </div>

      {listing.completeness && !listing.completeness.isPublishable && (
        <div className="flex items-start gap-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-4">
          <Info size={18} className="mt-0.5 shrink-0 text-[var(--warning)]" />
          <div className="text-sm text-[var(--text-primary)]">
            <p className="font-semibold">E'lon hali to'liq to'ldirilmagan</p>
            <p className="mt-1 text-[var(--text-secondary)]">
              Hamkor quyidagi bo'limlarni to'ldirmaguncha "Tasdiqlash" ishlamaydi:
            </p>
            <ul className="mt-2 list-inside list-disc text-[var(--text-secondary)]">
              {listing.completeness.missingFields.map((field) => (
                <li key={field}>{MISSING_FIELD_LABELS[field] ?? field}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Photos Gallery */}
          {listing.photos && listing.photos.length > 0 && (
            <div className="flex flex-col gap-2">
              <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-[var(--bg-tertiary)]">
                <Image
                  src={listing.photos[activePhoto]} 
                  alt="Hotel" 
                  fill
                  unoptimized
                  sizes="(min-width: 1024px) 660px, 100vw"
                  className="object-cover"
                />
              </div>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {listing.photos.map((photo, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActivePhoto(idx)}
                    className={`relative shrink-0 w-24 h-16 rounded-lg overflow-hidden border-2 transition-all ${activePhoto === idx ? "border-[var(--primary)]" : "border-transparent hover:border-[var(--border)]"}`}
                  >
                    <Image src={photo} alt="" fill unoptimized sizes="96px" className="object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="p-6 rounded-2xl border border-[var(--border)] bg-white">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Info size={18} className="text-[var(--text-muted)]" />
              Obyekt haqida
            </h3>
            <p className="text-[var(--text-secondary)] leading-relaxed">
              {listing.description || "Tavsif kiritilmagan."}
            </p>
          </div>

          {/* Amenities */}
          <div className="p-6 rounded-2xl border border-[var(--border)] bg-white">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
              <Star size={18} className="text-[var(--text-muted)]" />
              Qulayliklar
            </h3>
            <div className="flex flex-wrap gap-3">
              {listing.amenities ? listing.amenities.map((amenity) => {
                const Icon = AMENITY_ICONS[amenity] || Star;
                return (
                  <div key={amenity} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[var(--bg-tertiary)] text-sm font-medium text-[var(--text-secondary)] capitalize">
                    <Icon size={16} className="text-[var(--primary)]" />
                    {amenity}
                  </div>
                );
              }) : (
                <span className="text-sm text-[var(--text-muted)]">Qulayliklar kiritilmagan</span>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Sidebar */}
        <div className="flex flex-col gap-6">
          {/* Key Info */}
          <div className="p-6 rounded-2xl border border-[var(--border)] bg-white flex flex-col gap-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Asosiy ma'lumotlar</h3>
            
            <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
              <span className="text-sm text-[var(--text-muted)] flex items-center gap-2">
                <Star size={16} /> Yulduzlar
              </span>
              <span className="font-semibold">{listing.stars} yulduz</span>
            </div>
            
            <div className="flex justify-between items-center py-2 border-b border-[var(--border)]">
              <span className="text-sm text-[var(--text-muted)] flex items-center gap-2">
                <Users size={16} /> Xonalar soni
              </span>
              <span className="font-semibold">{listing.roomsCount || "Noma'lum"}</span>
            </div>

            <div className="flex flex-col gap-2 py-2">
              <span className="text-sm text-[var(--text-muted)] flex items-center gap-2">
                <MapPin size={16} /> To'liq manzil
              </span>
              <span className="font-medium text-sm leading-snug">{listing.address || listing.city}</span>
            </div>
          </div>

          {/* Rules */}
          {listing.rules && listing.type !== "bus" && (
            <div className="p-6 rounded-2xl border border-[var(--border)] bg-white flex flex-col gap-4">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">Uy qoidalari</h3>
              
              <div className="grid grid-cols-2 gap-4 mb-2">
                <div className="p-3 rounded-xl bg-[var(--bg-tertiary)] flex flex-col gap-1">
                  <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Check-in</span>
                  <span className="font-bold text-[var(--text-primary)]">{listing.rules.checkInTime || "--:--"}</span>
                </div>
                <div className="p-3 rounded-xl bg-[var(--bg-tertiary)] flex flex-col gap-1">
                  <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-semibold">Check-out</span>
                  <span className="font-bold text-[var(--text-primary)]">{listing.rules.checkOutTime || "--:--"}</span>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Bolalar ruxsat etilganmi?</span>
                  <span className="font-semibold">{listing.rules.childrenAllowed ? "Ha" : "Yo'q"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Uy hayvonlari?</span>
                  <span className="font-semibold">{listing.rules.petsAllowed ? "Ha" : "Yo'q"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-[var(--text-muted)]">Chekish?</span>
                  <span className="font-semibold">{listing.rules.smokingAllowed ? "Ha" : "Yo'q"}</span>
                </div>
                <div className="flex flex-col gap-1 mt-2 p-3 rounded-xl bg-orange-50/50 border border-orange-100">
                  <span className="text-xs text-orange-600 font-semibold uppercase">Bekor qilish siyosati</span>
                  <span className="text-sm font-medium text-orange-900 capitalize">{listing.rules.cancellationPolicy || "Noma'lum"}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
