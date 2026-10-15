"use client";

import { Send, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../_components/ui/button";
import { Drawer } from "../../_components/ui/drawer";
import { StarRating } from "../../_components/ui/star-rating";
import { formatDate } from "../../_lib/utils/format";
import type { PartnerReviewExtended } from "./types";

interface ReviewReplyDrawerProps {
  review: PartnerReviewExtended | null;
  open: boolean;
  onClose: () => void;
  onSubmitReply: (reviewId: string, replyText: string) => Promise<void>;
}

const QUICK_TEMPLATES = [
  "Assalomu alaykum! Tashrifingiz va yuqori bahoingiz uchun minnatdormiz. Sizni yana kutib qolishdan mamnun bo'lamiz!",
  "Fikringiz uchun katta rahmat! Bildirilgan takliflaringiz asosida xizmat sifatini yanada yaxshilash ustida ishlaymiz.",
  "Keltirilgan noqulayliklar uchun samimiy uzr so'raymiz. Kamchiliklarni zudlik bilan bartaraf etish choralarini ko'ramiz.",
];

export function ReviewReplyDrawer({
  review,
  open,
  onClose,
  onSubmitReply,
}: ReviewReplyDrawerProps) {
  if (!review) return null;

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title="Mijoz sharhiga rasmiy javob"
      description="Hamkor nomidan mijozga professional va xushmuomala javob qoldiring."
      size="md"
    >
      <ReviewReplyForm
        key={review.id}
        review={review}
        onClose={onClose}
        onSubmitReply={onSubmitReply}
      />
    </Drawer>
  );
}

interface ReviewReplyFormProps {
  review: PartnerReviewExtended;
  onClose: () => void;
  onSubmitReply: (reviewId: string, replyText: string) => Promise<void>;
}

function ReviewReplyForm({ review, onClose, onSubmitReply }: ReviewReplyFormProps) {
  const [replyText, setReplyText] = useState(review.reply?.text ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) {
      toast.error("Javob matnini kiriting");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmitReply(review.id, replyText.trim());
      toast.success("Javobingiz muvaffaqiyatli saqlandi!");
      onClose();
    } catch {
      toast.error("Javobni yuborishda xatolik yuz berdi");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 py-2">
      {/* Mijoz sharhi kartasi */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-muted)] p-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
              {review.userName}
            </span>
            {review.userCity && (
              <span className="text-[11px] text-[var(--muted-foreground)]">
                · {review.userCity}
              </span>
            )}
          </div>
          <StarRating value={review.rating} size={14} />
        </div>

        <p className="text-xs text-zinc-700 dark:text-zinc-300 leading-relaxed italic">
          "{review.body}"
        </p>

        <div className="mt-2 text-[10px] text-[var(--muted-foreground)]">
          {formatDate(review.createdAt)}
        </div>
      </div>

      {/* Tezkor javob shablonlari */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <Sparkles className="h-3.5 w-3.5 text-amber-500" />
          <span>Tezkor shablonlar (bosing):</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {QUICK_TEMPLATES.map((tmpl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setReplyText(tmpl)}
              className="text-left text-xs p-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--surface-muted)] transition-colors text-zinc-600 dark:text-zinc-300 leading-relaxed cursor-pointer"
            >
              {tmpl}
            </button>
          ))}
        </div>
      </div>

      {/* Javob matni maydoni */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          Sizning javobingiz:
        </label>
        <textarea
          rows={5}
          value={replyText}
          onChange={(e) => setReplyText(e.target.value)}
          placeholder="Hurmatli mijoz, fikringiz uchun rahmat..."
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-xs leading-relaxed outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
        />
        <div className="flex justify-between items-center text-[10px] text-[var(--muted-foreground)]">
          <span>Mijozlar ushbu javobni ilovada ko'radilar</span>
          <span>{replyText.length} ta belgi</span>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
        <Button variant="outline" size="sm" type="button" onClick={onClose} disabled={isSubmitting}>
          Bekor qilish
        </Button>
        <Button
          variant="primary"
          size="sm"
          type="submit"
          loading={isSubmitting}
          disabled={isSubmitting || !replyText.trim()}
          className="gap-1.5"
        >
          <Send className="h-3.5 w-3.5" />
          <span>Javobni yuborish</span>
        </Button>
      </div>
    </form>
  );
}
