import { request } from "../client";

export interface PartnerReview {
  id: string;
  hotelId: string;
  userId: string;
  rating: number;
  body: string;
  status: "pending" | "published" | "rejected";
  createdAt: string;
}

export function listReviews(token?: string | null) {
  return request<PartnerReview[]>("/partners/reviews", { token });
}

export function replyToReview(
  reviewId: string,
  body: { reply: string },
  token?: string | null,
) {
  return request<PartnerReview>(`/partners/reviews/${reviewId}/reply`, {
    method: "POST",
    body,
    token,
  });
}
