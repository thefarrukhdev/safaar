"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "../../_components/layout/page-header";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels } from "../../_lib/utils/partner-labels";
import { useReviews, useReplyToReview } from "../../_hooks/use-reviews";
import { ReviewsStats } from "./reviews-stats";
import { ReviewsFilters } from "./reviews-filters";
import { ReviewsList } from "./reviews-list";
import { ReviewReplyDrawer } from "./review-reply-drawer";
import type {
  PartnerReviewExtended,
  ReviewFilterKey,
  ReviewSortOption,
  ReviewStatsData,
} from "./types";

export function ReviewsView() {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);

  const { data: reviews = [], isLoading } = useReviews();
  const replyMutation = useReplyToReview();

  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ReviewFilterKey>("all");
  const [sortBy, setSortBy] = useState<ReviewSortOption>("newest");

  // Drawer holati
  const [selectedReview, setSelectedReview] = useState<PartnerReviewExtended | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  /**
   * Hisoblangan statistika
   */
  const stats = useMemo<ReviewStatsData>(() => {
    const total = reviews.length;
    if (total === 0) {
      return {
        averageRating: 0,
        totalReviews: 0,
        positivePercentage: 0,
        unansweredCount: 0,
        starCounts: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      };
    }

    let sum = 0;
    let positiveCount = 0;
    let unansweredCount = 0;
    const starCounts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };

    for (const r of reviews) {
      sum += r.rating;
      if (r.rating >= 4) positiveCount += 1;
      if (!r.reply?.text) unansweredCount += 1;
      const rounded = Math.max(1, Math.min(5, Math.round(r.rating))) as 1 | 2 | 3 | 4 | 5;
      starCounts[rounded] = (starCounts[rounded] || 0) + 1;
    }

    return {
      averageRating: sum / total,
      totalReviews: total,
      positivePercentage: Math.round((positiveCount / total) * 100),
      unansweredCount,
      starCounts,
    };
  }, [reviews]);

  /**
   * Filtrlash
   */
  const filtered = useMemo(() => {
    let list = reviews;

    // Filter bo'yicha
    switch (activeFilter) {
      case "5star":
        list = list.filter((r) => r.rating === 5);
        break;
      case "4star":
        list = list.filter((r) => r.rating === 4);
        break;
      case "critical":
        list = list.filter((r) => r.rating <= 3);
        break;
      case "unanswered":
        list = list.filter((r) => !r.reply?.text);
        break;
      case "answered":
        list = list.filter((r) => Boolean(r.reply?.text));
        break;
      case "all":
      default:
        break;
    }

    // Qidiruv bo'yicha
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (r) =>
          r.userName.toLowerCase().includes(q) ||
          r.body.toLowerCase().includes(q) ||
          (r.reply?.text && r.reply.text.toLowerCase().includes(q)),
      );
    }

    // Saralash
    return [...list].sort((a, b) => {
      switch (sortBy) {
        case "highest":
          return b.rating - a.rating;
        case "lowest":
          return a.rating - b.rating;
        case "newest":
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  }, [reviews, activeFilter, query, sortBy]);

  const handleOpenReplyDrawer = (review: PartnerReviewExtended) => {
    setSelectedReview(review);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setSelectedReview(null);
  };

  const handleSubmitReply = async (reviewId: string, replyText: string) => {
    await replyMutation.mutateAsync({ reviewId, reply: replyText });
  };

  const handleResetFilters = () => {
    setQuery("");
    setActiveFilter("all");
    setSortBy("newest");
  };

  const isFiltered = Boolean(query.trim() || activeFilter !== "all");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Hamkor paneli"
        title="Mijozlar sharhlari"
        description={`${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} va xizmatlarga mijozlar tomonidan qoldirilgan fikr-mulohazalar va reyting.`}
      />

      {/* 1. Statistika kartalari */}
      <ReviewsStats stats={stats} isLoading={isLoading} />

      {/* 2. Filtrlash va saralash boshqaruvi */}
      <ReviewsFilters
        query={query}
        onQueryChange={setQuery}
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        sortBy={sortBy}
        onSortChange={setSortBy}
        stats={stats}
        onReset={handleResetFilters}
      />

      {/* 3. Sharhlar ro'yxati */}
      <ReviewsList
        reviews={filtered}
        onOpenReply={handleOpenReplyDrawer}
        onResetFilters={handleResetFilters}
        isFiltered={isFiltered}
      />

      {/* 4. Javob qaytarish Draweri */}
      <ReviewReplyDrawer
        review={selectedReview}
        open={drawerOpen}
        onClose={handleCloseDrawer}
        onSubmitReply={handleSubmitReply}
      />
    </div>
  );
}
