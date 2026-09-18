"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Star, Eye, EyeOff, ShieldOff, Image as ImageIcon } from "lucide-react";
import Card from "@/components/ui/Card";
import DataTable, { Column } from "@/components/ui/DataTable";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { AdminApi } from "@/lib/api/admin-api";
import { extractApiErrorMessage } from "@/lib/utils";
import type { AdminReview, AdminReviewStatus } from "@/types/admin";

/**
 * 2026-09-14 SAFAAR admin gap closure — real Reviews moderation UI,
 * wired to GET/POST /admin/reviews (admin.service.ts::reviewsList /
 * reviewModerate, both new this session). No mock data.
 */

const STATUS_OPTIONS = [
  { value: "", label: "Barcha holatlar" },
  { value: "published", label: "Nashr qilingan" },
  { value: "pending_review", label: "Ko'rib chiqilmoqda" },
  { value: "hidden", label: "Yashirilgan" },
];

const RATING_OPTIONS = [
  { value: "", label: "Barcha reytinglar" },
  { value: "4", label: "4+ yulduz" },
  { value: "3", label: "3+ yulduz" },
  { value: "2", label: "2+ yulduz" },
];

const STATUS_BADGE: Record<AdminReviewStatus, { label: string; className: string }> = {
  published: { label: "Nashr qilingan", className: "bg-emerald-100 text-emerald-700" },
  pending_review: { label: "Ko'rib chiqilmoqda", className: "bg-amber-100 text-amber-700" },
  hidden: { label: "Yashirilgan", className: "bg-slate-200 text-slate-600" },
};

function isForbidden(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    (err as { response?: { status?: number } }).response?.status === 403
  );
}

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [forbidden, setForbidden] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchReviews = () => {
    setLoading(true);
    setError(false);
    setForbidden(false);
    AdminApi.getReviews({
      status: statusFilter as AdminReviewStatus | "",
      minRating: ratingFilter ? Number(ratingFilter) : undefined,
    })
      .then((items) => setReviews(items))
      .catch((err) => {
        if (isForbidden(err)) setForbidden(true);
        else setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const load = () => fetchReviews();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, ratingFilter]);

  const handleModerate = async (review: AdminReview, action: "publish" | "hide") => {
    setActingId(review.id);
    try {
      const result =
        action === "publish"
          ? await AdminApi.publishReview(review.id)
          : await AdminApi.hideReview(review.id);
      setReviews((prev) =>
        prev.map((r) => (r.id === review.id ? { ...r, status: result.status } : r)),
      );
      toast.success(
        action === "publish" ? "Sharh nashr qilindi" : "Sharh yashirildi",
      );
    } catch (err) {
      toast.error(
        extractApiErrorMessage(err, "Amalni bajarib bo'lmadi"),
      );
    } finally {
      setActingId(null);
    }
  };

  const columns: Column<AdminReview>[] = useMemo(
    () => [
      {
        key: "userName",
        label: "Mijoz",
        render: (r) => (
          <div>
            <div className="font-medium text-[var(--text-primary)]">{r.userName}</div>
            <div className="text-xs text-[var(--text-muted)]">
              {new Date(r.createdAt).toLocaleDateString("uz-UZ", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </div>
          </div>
        ),
      },
      {
        key: "targetName",
        label: "Obyekt",
        render: (r) => (
          <div>
            <div className="text-[var(--text-primary)]">{r.targetName}</div>
            <div className="text-xs text-[var(--text-muted)] capitalize">{r.targetType}</div>
          </div>
        ),
      },
      {
        key: "rating",
        label: "Reyting",
        render: (r) => (
          <span className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)]">
            <Star size={14} className="fill-[var(--warning)] text-[var(--warning)]" aria-hidden />
            {r.rating.toFixed(1)}
          </span>
        ),
      },
      {
        key: "body",
        label: "Sharh matni",
        render: (r) => (
          <div className="max-w-xs">
            <p className="line-clamp-2 text-[var(--text-secondary)]">
              {r.body || <span className="text-[var(--text-muted)]">Matn yo&apos;q</span>}
            </p>
            {r.photos.length > 0 && (
              <span className="inline-flex items-center gap-1 text-xs text-[var(--text-muted)] mt-1">
                <ImageIcon size={12} aria-hidden /> {r.photos.length} ta rasm
              </span>
            )}
          </div>
        ),
      },
      {
        key: "status",
        label: "Holat",
        render: (r) => (
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_BADGE[r.status].className}`}
          >
            {STATUS_BADGE[r.status].label}
          </span>
        ),
      },
      {
        key: "actions",
        label: "",
        render: (r) => (
          <div className="flex justify-end gap-2">
            {r.status !== "published" && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Eye size={14} aria-hidden />}
                loading={actingId === r.id}
                onClick={() => void handleModerate(r, "publish")}
                aria-label={`${r.userName} sharhini nashr qilish`}
              >
                Nashr qilish
              </Button>
            )}
            {r.status !== "hidden" && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[var(--danger)]"
                icon={<EyeOff size={14} aria-hidden />}
                loading={actingId === r.id}
                onClick={() => void handleModerate(r, "hide")}
                aria-label={`${r.userName} sharhini yashirish`}
              >
                Yashirish
              </Button>
            )}
          </div>
        ),
      },
    ],
    [actingId],
  );

  if (forbidden) {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center text-center gap-3 py-16">
          <ShieldOff size={28} className="text-[var(--danger)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Bu bo&apos;lim uchun ruxsatingiz yo&apos;q
          </p>
          <p className="text-xs text-[var(--text-muted)] max-w-sm">
            Sharhlarni ko&apos;rish uchun reviews:read ruxsati kerak.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Sharhlar</h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Mijozlarning mehmonxona/xizmat sharhlarini moderatsiya qilish
          </p>
        </div>
        <div className="flex gap-3">
          <div className="w-44">
            <Select
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Holat bo'yicha filtr"
            />
          </div>
          <div className="w-44">
            <Select
              options={RATING_OPTIONS}
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              aria-label="Reyting bo'yicha filtr"
            />
          </div>
        </div>
      </div>

      <DataTable
        columns={columns}
        data={reviews}
        keyField="id"
        emptyMessage="Sharhlar topilmadi"
        isLoading={loading}
        isError={error}
        onRetry={fetchReviews}
      />
    </div>
  );
}
