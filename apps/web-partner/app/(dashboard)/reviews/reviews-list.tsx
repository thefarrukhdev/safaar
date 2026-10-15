"use client";

import {
  CheckCircle2,
  MessageSquare,
  Pencil,
} from "lucide-react";
import { Button } from "../../_components/ui/button";
import { EmptyState } from "../../_components/ui/empty-state";
import { StarRating } from "../../_components/ui/star-rating";
import { formatDate } from "../../_lib/utils/format";
import type { PartnerReviewExtended } from "./types";

interface ReviewsListProps {
  reviews: PartnerReviewExtended[];
  onOpenReply: (review: PartnerReviewExtended) => void;
  onResetFilters?: () => void;
  isFiltered?: boolean;
}

export function ReviewsList({
  reviews,
  onOpenReply,
  onResetFilters,
  isFiltered,
}: ReviewsListProps) {
  if (reviews.length === 0) {
    return (
      <EmptyState
        icon={<MessageSquare className="h-10 w-10 text-[var(--muted-foreground)]" />}
        title="Sharhlar topilmadi"
        description={
          isFiltered
            ? "Tanlangan filtrlar bo'yicha sharhlar mavjud emas. Filtrlarni tozalab ko'ring."
            : "Hozircha mijozlar tomonidan sharh qoldirilmagan."
        }
        action={
          isFiltered && onResetFilters ? (
            <Button variant="outline" size="sm" onClick={onResetFilters}>
              Filtrlarni tozalash
            </Button>
          ) : undefined
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {reviews.map((rev) => {
        const initials = rev.userName
          .trim()
          .split(/\s+/)
          .filter(Boolean)
          .map((w) => w[0])
          .slice(0, 2)
          .join("")
          .toUpperCase() || "M";

        const hasReply = Boolean(rev.reply?.text);

        return (
          <div
            key={rev.id}
            className="flex flex-col gap-3 rounded-card border border-[var(--border)] bg-[var(--surface)] p-5 transition-shadow hover:shadow-xs"
          >
            {/* Header: Mijoz ma'lumotlari & Reyting */}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand-100 to-brand-200 text-xs font-bold text-brand-700 dark:from-brand-900/60 dark:to-brand-800/40 dark:text-brand-300">
                  {initials}
                </span>

                <div className="flex flex-col">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                      {rev.userName}
                    </span>
                    {rev.userCity && (
                      <span className="text-xs text-[var(--muted-foreground)]">
                        · {rev.userCity}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    <span>{formatDate(rev.createdAt)}</span>
                    {rev.roomTypeName && (
                      <>
                        <span>·</span>
                        <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.2 text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
                          {rev.roomTypeName}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <StarRating value={rev.rating} size={15} />
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  {rev.rating}.0
                </span>
              </div>
            </div>

            {/* Sharh matni */}
            <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
              {rev.body}
            </p>

            {/* Hamkor javobi (agar mavjud bo'lsa) */}
            {hasReply ? (
              <div className="mt-2 rounded-xl border border-brand-200/60 bg-brand-50/40 p-4 dark:border-brand-900/40 dark:bg-brand-950/20">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-800 dark:text-brand-300">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Sizning rasmiy javobingiz</span>
                    {rev.reply?.repliedAt && (
                      <span className="text-[11px] font-normal text-[var(--muted-foreground)] ml-1">
                        · {formatDate(rev.reply.repliedAt)}
                      </span>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onOpenReply(rev)}
                    className="h-7 text-xs text-brand-700 dark:text-brand-300 gap-1 hover:bg-brand-100/50"
                  >
                    <Pencil className="h-3 w-3" />
                    <span>Tahrirlash</span>
                  </Button>
                </div>

                <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed">
                  {rev.reply?.text}
                </p>
              </div>
            ) : (
              /* Javob qaytarish tugmasi */
              <div className="mt-1 flex items-center justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenReply(rev)}
                  className="gap-1.5 text-xs"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-brand-600" />
                  <span>Javob qaytarish</span>
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
