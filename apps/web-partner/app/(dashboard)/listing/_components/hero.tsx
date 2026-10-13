"use client";

import { Eye, EyeOff, ImageIcon, Loader2, Send, LayoutList, Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../_components/ui/button";
import { Tooltip } from "../../../_components/ui/tooltip";
import {
  LISTING_STATUS_INFO,
  ListingStatus,
} from "../../../_lib/domain/listing";
import { cn } from "../../../_lib/utils/cn";
import {
  useListing,
  useListingCompleteness,
  useUpdateListingStatus,
} from "../../../_hooks/use-listing";

interface HeroProps {
  onPreview: () => void;
}

const SECTIONS = 5;

export function Hero({ onPreview }: HeroProps) {
  const { data: listing } = useListing();
  const { complete, missing } = useListingCompleteness();
  const updateStatus = useUpdateListingStatus();

  const info = LISTING_STATUS_INFO[listing.status];
  const cover = listing.photos.find((p) => p.isCover) ?? listing.photos[0];

  // Progress hisoblash — har bo'lim uchun kichik mezon
  const filled = [
    listing.name.trim().length >= 3 &&
      listing.shortDescription.trim().length >= 20 &&
      listing.fullDescription.trim().length >= 100,
    listing.photos.length >= 3,
    listing.amenities.length >= 3,
    Boolean(listing.address.trim()) && listing.nearby.length > 0,
    Boolean(listing.checkInTime && listing.checkOutTime),
  ].filter(Boolean).length;

  const progress = Math.round((filled / SECTIONS) * 100);

  const statusToneClass = {
    warning: "bg-amber-500",
    accent: "bg-accent-500",
    brand: "bg-brand-500",
    neutral: "bg-zinc-400",
  }[info.tone];

  const handlePrimary = () => {
    if (listing.status === ListingStatus.PUBLISHED) {
      updateStatus.mutate(ListingStatus.HIDDEN, {
        onSuccess: () => toast.success("E'lon yashirildi"),
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Xato yuz berdi");
        },
      });
      return;
    }
    if (listing.status === ListingStatus.HIDDEN) {
      updateStatus.mutate(ListingStatus.UNDER_REVIEW, {
        onSuccess: () =>
          toast.success("E'lon qayta ko'rib chiqishga yuborildi"),
        onError: (error) => {
          toast.error(error instanceof Error ? error.message : "Xato yuz berdi");
        },
      });
      return;
    }
    // DRAFT yoki UNDER_REVIEW
    if (!complete) {
      toast.error("E'lon to'liq to'ldirilmagan", {
        description: missing[0],
      });
      return;
    }
    updateStatus.mutate(ListingStatus.UNDER_REVIEW, {
      onSuccess: () =>
        toast.success("Ko'rib chiqishga yuborildi", {
          description: "Admin tekshirgandan keyin nashr qilinadi.",
        }),
      onError: (error) => {
        toast.error(error instanceof Error ? error.message : "Xato yuz berdi");
      },
    });
  };

  return (
    <div className="relative overflow-hidden rounded-card border border-[var(--border)] bg-[var(--surface)] shadow-sm">
      {/* Cover strip */}
      <div className="relative h-40 w-full overflow-hidden bg-gradient-to-br from-brand-100 to-accent-100 dark:from-brand-900/40 dark:to-accent-900/30 md:h-48">
        {cover ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={cover.url}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-brand-700/40 dark:text-brand-200/40">
            <ImageIcon className="h-16 w-16" aria-hidden />
          </div>
        )}

        {/* Status pill — overlaid */}
        <div className="absolute right-4 top-4">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold text-white shadow-lg backdrop-blur",
              statusToneClass,
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-white" aria-hidden />
            {info.label}
          </span>
        </div>
      </div>

      {/* Bottom content */}
      <div className="relative flex flex-col gap-4 p-5 md:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 className="truncate text-2xl font-bold tracking-tight md:text-3xl">
              {listing.name || "Nomi kiritilmagan"}
            </h2>
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  className={cn(
                    "h-4 w-4",
                    n <= listing.stars
                      ? "fill-amber-400 stroke-amber-500"
                      : "fill-transparent stroke-zinc-300",
                  )}
                  aria-hidden
                />
              ))}
              <span className="ml-1 text-sm text-[var(--muted-foreground)]">
                {listing.stars} yulduzli · {listing.city}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" onClick={onPreview}>
              <Eye className="h-4 w-4" aria-hidden />
              Ko'rib chiqish
            </Button>
            {listing.status === ListingStatus.PUBLISHED && (
              <Button variant="outline" size="sm" onClick={handlePrimary}>
                <EyeOff className="h-4 w-4" aria-hidden />
                Yashirish
              </Button>
            )}
            {listing.status === ListingStatus.HIDDEN && (
              <Button size="sm" onClick={handlePrimary}>
                <Eye className="h-4 w-4" aria-hidden />
                Qayta nashr
              </Button>
            )}
            {(listing.status === ListingStatus.DRAFT ||
              listing.status === ListingStatus.UNDER_REVIEW) && (
              <Tooltip
                content={complete ? "" : `Yetishmayapti: ${missing[0]}`}
              >
                <Button
                  size="sm"
                  onClick={handlePrimary}
                  disabled={!complete || updateStatus.isPending}
                >
                  {listing.status === ListingStatus.UNDER_REVIEW ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  ) : (
                    <Send className="h-4 w-4" aria-hidden />
                  )}
                  {listing.status === ListingStatus.UNDER_REVIEW
                    ? "Tekshirilmoqda..."
                    : "Nashrga yuborish"}
                </Button>
              </Tooltip>
            )}
          </div>
        </div>

        {/* Progress */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium">
              <LayoutList className="h-3.5 w-3.5 text-brand-600" aria-hidden />
              To'ldirilganlik
            </span>
            <span className="text-[var(--muted-foreground)]">
              <strong className="text-[var(--foreground)]">{filled}</strong> /{" "}
              {SECTIONS} bo'lim
              {progress === 100 && " · barchasi tayyor 🎉"}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                progress === 100
                  ? "bg-accent-500"
                  : progress >= 60
                    ? "bg-brand-500"
                    : "bg-amber-500",
              )}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
