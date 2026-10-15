export interface PartnerReviewExtended {
  id: string;
  hotelId: string;
  userId: string;
  userName: string;
  userAvatar?: string;
  userCity?: string;
  roomTypeName?: string;
  rating: number;
  body: string;
  status: "pending" | "published" | "rejected";
  createdAt: string;
  reply?: {
    text: string;
    repliedAt: string;
  };
}

export type ReviewFilterKey =
  | "all"
  | "5star"
  | "4star"
  | "critical"
  | "unanswered"
  | "answered";

export type ReviewSortOption = "newest" | "highest" | "lowest";

export interface ReviewStatsData {
  averageRating: number;
  totalReviews: number;
  positivePercentage: number;
  unansweredCount: number;
  starCounts: {
    5: number;
    4: number;
    3: number;
    2: number;
    1: number;
  };
}
