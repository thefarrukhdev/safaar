"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listReviews, replyToReview } from "../_lib/api/endpoints/reviews";
import { useAuthStore } from "../_stores/auth-store";
import type { PartnerReviewExtended } from "../(dashboard)/reviews/types";

export const reviewsQueryKey = ["partner", "reviews"] as const;

const MOCK_REVIEWS: PartnerReviewExtended[] = [
  {
    id: "rev-101",
    hotelId: "hotel-1",
    userId: "usr-1",
    userName: "Dilshod Aliyev",
    userCity: "Toshkent",
    roomTypeName: "Deluxe Suite",
    rating: 5,
    body: "Xizmat ko'rsatish juda a'lo darajada! Xonalar toza, shinam va xodimlar xushmuomala. Ayniqsa ertalabki nonushta xilma-xilligi va mazasi juda yoqdi. Albatta yana kelamiz!",
    status: "published",
    createdAt: "2026-10-12T14:30:00Z",
    reply: {
      text: "Assalomu alaykum, Dilshod aka! Samimiy fikringiz va yuqori bahoingiz uchun katta rahmat! Sizni yana mehmondorchilikda kutib qolishdan mamnun bo'lamiz.",
      repliedAt: "2026-10-12T16:00:00Z",
    },
  },
  {
    id: "rev-102",
    hotelId: "hotel-1",
    userId: "usr-2",
    userName: "Malika Karimova",
    userCity: "Samarqand",
    roomTypeName: "Standart Ikki Kishilik",
    rating: 5,
    body: "Oilaviy dam olish uchun ajoyib maskan. Bolalar uchun barcha qulayliklar bor. Tozalik va osoyishtalik bo'yicha eng yaxshi joylardan biri.",
    status: "published",
    createdAt: "2026-10-10T09:15:00Z",
    reply: {
      text: "Katta rahmat, Malika opa! Oila a'zolaringiz bilan bizni tanlaganingizdan juda xursandmiz. Yana kutib qolamiz!",
      repliedAt: "2026-10-10T11:20:00Z",
    },
  },
  {
    id: "rev-103",
    hotelId: "hotel-1",
    userId: "usr-3",
    userName: "Jasur Normurodov",
    userCity: "Buxoro",
    roomTypeName: "Standart Xona",
    rating: 3,
    body: "Joylashuvi zo'r, shahar markaziga juda yaqin. Lekin xonada Wi-Fi signali biroz past edi va kechqurun ko'chadan shovqin eshitildi. Iltimos, internet sifatini yaxshilang.",
    status: "published",
    createdAt: "2026-10-08T18:45:00Z",
    // Javob berilmagan (unanswered)
  },
  {
    id: "rev-104",
    hotelId: "hotel-1",
    userId: "usr-4",
    userName: "Rustam Zokirov",
    userCity: "Farg'ona",
    roomTypeName: "Family Suite",
    rating: 4,
    body: "Umuman olganda juda yoqdi. Basseyn va sauna ajoyib. Faqat ro'yxatdan o'tish (Check-in) jarayoni navbat tufayli 15 daqiqa cho'zildi. Xizmat sifatini yanada tezlashtirish mumkin.",
    status: "published",
    createdAt: "2026-10-05T12:00:00Z",
    // Javob berilmagan (unanswered)
  },
  {
    id: "rev-105",
    hotelId: "hotel-1",
    userId: "usr-5",
    userName: "Nigora Usmonova",
    userCity: "Andijon",
    roomTypeName: "Deluxe Suite",
    rating: 5,
    body: "Barcha talablarimizga to'liq javob berdi. To'shaklar juda qulay, manzarasi shinam. O'zbekona mehmondo'stlik uchun butun jamoaga tashakkur!",
    status: "published",
    createdAt: "2026-10-02T16:20:00Z",
    reply: {
      text: "Fikringiz biz uchun juda qadrli, Nigora xonim! Mehmonlarimizning qulayligi bizning birinchi darajali vazifamiz.",
      repliedAt: "2026-10-02T17:10:00Z",
    },
  },
];

export function useReviews() {
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);

  const query = useQuery({
    queryKey: [...reviewsQueryKey, accessToken],
    queryFn: async () => {
      try {
        const apiReviews = await listReviews(accessToken);
        if (apiReviews && apiReviews.length > 0) {
          return apiReviews.map((r) => ({
            ...r,
            userName: `Mijoz #${r.userId.slice(0, 4)}`,
            roomTypeName: "Band qilingan xona",
          })) as PartnerReviewExtended[];
        }
      } catch {
        // Backend endpoint hali tayyor bo'lmaganda yoki 404 berganda mock ma'lumotlar fallback bo'ladi
      }
      return MOCK_REVIEWS;
    },
    staleTime: 60_000,
  });

  return {
    data: query.data ?? MOCK_REVIEWS,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useReplyToReview() {
  const queryClient = useQueryClient();
  const accessToken = useAuthStore((s) => s.tokens?.accessToken);

  return useMutation({
    mutationFn: async ({ reviewId, reply }: { reviewId: string; reply: string }) => {
      try {
        await replyToReview(reviewId, { reply }, accessToken);
      } catch {
        // Agar backend hali mock holatda bo'lsa, optimistik davom etamiz
      }
      return { reviewId, reply };
    },
    onSuccess: ({ reviewId, reply }) => {
      queryClient.setQueryData<PartnerReviewExtended[]>(
        [...reviewsQueryKey, accessToken],
        (old) => {
          if (!old) return old;
          return old.map((r) =>
            r.id === reviewId
              ? {
                  ...r,
                  reply: {
                    text: reply,
                    repliedAt: new Date().toISOString(),
                  },
                }
              : r,
          );
        },
      );
    },
  });
}
