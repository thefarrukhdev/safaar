"use client";

import { useState } from "react";
import Image from "next/image";
import { ShieldCheck, Camera } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { ReviewsDict } from "@/i18n/dictionaries";
import type { ReviewView } from "@/types/view";
import { PhotoLightbox } from "./PhotoLightbox";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { api } from "@/lib/api";

const LOCALE_TAG: Record<Locale, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-US",
};

function formatReviewDate(createdAt: string, locale: Locale): string | null {
  if (!createdAt) return null;
  const date = new Date(createdAt);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(LOCALE_TAG[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export type ExtendedReview = ReviewView & {
  authorName?: string;
  avatarUrl?: string;
  photos?: string[];
  isVerifiedGuest?: boolean;
};

export function ReviewsList({
  reviews: initialReviews,
  dict,
  locale,
  hotelId,
  authed,
  token,
}: {
  reviews: ReviewView[];
  dict: ReviewsDict;
  locale: Locale;
  hotelId?: string;
  authed?: boolean;
  token?: string;
}) {
  const [reviewsList, setReviewsList] = useState<ExtendedReview[]>(initialReviews as ExtendedReview[]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelId || !token) return;
    
    setIsSubmitting(true);
    try {
      let uploadedPhotos: string[] = [];
      if (files.length > 0) {
        uploadedPhotos = await api.reviews.uploadReviewPhotos(files, { token });
      }
      
      const newReview = await api.reviews.createReview({
        targetType: "hotel",
        targetId: hotelId,
        rating,
        body,
        photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
      }, { token });
      
      setReviewsList([newReview as ExtendedReview, ...reviewsList]);
      setIsFormOpen(false);
      setBody("");
      setRating(5);
      setFiles([]);
    } catch (err) {
      console.error(err);
      alert("Sharh qoldirishda xatolik yuz berdi");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lightbox state
  const [activePhotoList, setActivePhotoList] = useState<string[] | null>(null);
  const [photoIndex, setPhotoIndex] = useState(0);

  const openLightbox = (photos: string[], index: number) => {
    setActivePhotoList(photos);
    setPhotoIndex(index);
  };

  // Calculate overall average ratings
  const totalCount = reviewsList.length;
  const avgOverall =
    totalCount > 0
      ? (
          reviewsList.reduce((acc, r) => acc + Math.max(0, Number(r.rating) || 0), 0) / totalCount
        ).toFixed(1)
      : "0.0";

  return (
    <div className="flex flex-col gap-8">
      {/* Header Summary & Rating Breakdown */}
      <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
        
        {/* Left Side: Overall Score */}
        <div className="flex flex-col gap-2">
          <div className="flex items-end gap-3">
            <span className="text-6xl font-extrabold text-slate-900 tracking-tight">
              {avgOverall}
            </span>
            <div className="flex flex-col pb-1.5">
              <span className="text-sm font-semibold text-slate-900">Exceptional</span>
              <span className="text-sm text-slate-500">{totalCount} {dict.title}</span>
            </div>
          </div>
        </div>

        {/* Right Side: Breakdown (Mocked) */}
        <div className="flex-1 max-w-md w-full flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-900 w-24">Cleanliness</span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full" style={{ width: '98%' }}></div>
            </div>
            <span className="text-sm font-bold text-slate-900 w-8 text-right">4.9</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-900 w-24">Location</span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full" style={{ width: '100%' }}></div>
            </div>
            <span className="text-sm font-bold text-slate-900 w-8 text-right">5.0</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium text-slate-900 w-24">Service</span>
            <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-slate-900 rounded-full" style={{ width: '96%' }}></div>
            </div>
            <span className="text-sm font-bold text-slate-900 w-8 text-right">4.8</span>
          </div>
        </div>

        {authed && hotelId && !isFormOpen && (
          <Button onClick={() => setIsFormOpen(true)} variant="secondary" className="border-slate-200 text-slate-900">
            Write a review
          </Button>
        )}
      </div>

      {isFormOpen && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="font-bold text-slate-900">Write a Review</h3>
          
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-900">Rating (1-5)</label>
            <select 
              value={rating} 
              onChange={(e) => setRating(Number(e.target.value))}
              className="rounded-xl border border-slate-200 bg-white p-2.5 text-sm outline-none focus:border-slate-400"
            >
              {[5,4,3,2,1].map(num => <option key={num} value={num}>{num} Stars</option>)}
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-900">Review Text</label>
            <textarea 
              required
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              className="rounded-xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-slate-400"
              placeholder="Tell us about your experience..."
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-slate-900">Photos (optional)</label>
            <input 
              type="file" 
              multiple 
              accept="image/*"
              onChange={(e) => {
                if (e.target.files) {
                  setFiles(Array.from(e.target.files));
                }
              }}
              className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-slate-100 file:text-slate-900 hover:file:bg-slate-200"
            />
          </div>

          <div className="flex gap-2 justify-end mt-4">
            <Button type="button" variant="ghost" onClick={() => setIsFormOpen(false)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? "Submitting..." : "Submit Review"}
            </Button>
          </div>
        </form>
      )}

      {/* Reviews List */}
      {reviewsList.length === 0 ? (
        <div className="py-16 text-center text-slate-500">
          {dict.empty}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reviewsList.map((review) => {
            const rating = Math.max(0, Math.min(5, Math.round(review.rating)));
            const dateLabel = formatReviewDate(review.createdAt, locale);

            return (
              <div
                key={review.id}
                className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-6 transition-all hover:shadow-sm"
              >
                {/* Author Info Header */}
                <div className="flex items-center gap-4">
                  <Avatar
                    src={review.avatarUrl}
                    alt={review.authorName || "Guest"}
                    fallback={review.authorName?.charAt(0) || "G"}
                    size="md"
                  />

                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-slate-900">
                        {review.authorName || "Guest"}
                      </span>
                      {review.isVerifiedGuest && (
                        <ShieldCheck className="h-4 w-4 text-emerald-600" />
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-900">
                        {rating}.0
                      </span>
                      {dateLabel && (
                        <span className="text-sm text-slate-500">
                          • {dateLabel}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Review Text */}
                {review.body && (
                  <p className="text-base leading-relaxed text-slate-700">
                    {review.body}
                  </p>
                )}

                {/* Photo Gallery Thumbnails */}
                {review.photos && review.photos.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {review.photos.map((photo, idx) => (
                      <button
                         key={idx}
                         type="button"
                         onClick={() => openLightbox(review.photos!, idx)}
                         className="group relative h-24 w-24 overflow-hidden rounded-xl bg-slate-100"
                       >
                         <Image
                           src={photo}
                           alt={`Review photo ${idx + 1}`}
                           fill
                           className="object-cover transition-transform duration-200 group-hover:scale-105"
                         />
                         <div className="absolute inset-0 bg-black/10 opacity-0 transition-opacity group-hover:opacity-100 grid place-items-center">
                           <Camera className="h-6 w-6 text-white" />
                         </div>
                       </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Photo Lightbox Modal */}
      {activePhotoList && (
        <PhotoLightbox
          photos={activePhotoList}
          currentIndex={photoIndex}
          onClose={() => setActivePhotoList(null)}
          onNavigate={(newIdx) => setPhotoIndex(newIdx)}
        />
      )}
    </div>
  );
}
