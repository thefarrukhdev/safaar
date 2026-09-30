"use client";

import { Star, MessageSquare, ThumbsUp, Clock, AlertCircle } from "lucide-react";
import { PageHeader } from "../../_components/layout/page-header";
import { EmptyState } from "../../_components/ui/empty-state";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels } from "../../_lib/utils/partner-labels";

/**
 * Mijozlar sharhlari sahifasi.
 *
 * ⚠️ BACKEND TAYYORLANISHI KERAK:
 * Hozirda `GET /partners/reviews` endpointi mavjud emas.
 * Backend endpoint tayyor bo'lgach, bu sahifaga API integratsiyasini
 * qo'shing (pastdagi `TODO: BACKEND` belgisini qidiring).
 *
 * Backend dev uchun ko'rsatma: `apps/web-partner/app/_lib/api/endpoints/reviews.ts`
 */
export function ReviewsView() {
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);

  // TODO: BACKEND — listReviews() hook shu yerga qo'shiladi
  // const { data: reviews, isLoading } = useReviews();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Hamkor paneli"
        title="Mijozlar sharhlari"
        description={`${labels.unitSingular.charAt(0).toUpperCase() + labels.unitSingular.slice(1)} va xizmatlarga mijozlar tomonidan qoldirilgan sharhlar.`}
      />

      {/* Statistika kartalar — backend tayyor bo'lgach real data bilan to'ldiriladi */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={<Star className="h-5 w-5 text-yellow-500" />}
          label="O'rtacha reyting"
          value="—"
          bg="bg-yellow-50 dark:bg-yellow-900/20"
        />
        <StatCard
          icon={<MessageSquare className="h-5 w-5 text-brand-500" />}
          label="Jami sharhlar"
          value="—"
          bg="bg-brand-50 dark:bg-brand-900/20"
        />
        <StatCard
          icon={<ThumbsUp className="h-5 w-5 text-green-500" />}
          label="Ijobiy sharhlar"
          value="—"
          bg="bg-green-50 dark:bg-green-900/20"
        />
      </div>

      {/* Asosiy kontent */}
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>
            <strong>Ishlanmoqda:</strong> Sharhlar tizimi tez orada ishga tushiriladi. Backend
            jamoasi API endpointlarini tayyorlashda.
          </span>
        </div>

        <EmptyState
          icon={<Clock className="h-10 w-10 text-[var(--muted-foreground)]" />}
          title="Sharhlar hali mavjud emas"
          description="Mijozlar sizning xizmatingiz haqida sharhlar qoldirgach, ular shu yerda ko'rinadi. Siz sharhlarga javob berishingiz va reytingingizni kuzatib borishingiz mumkin bo'ladi."
        />
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  bg,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  bg: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg}`}>
        {icon}
      </div>
      <div>
        <p className="text-xs text-[var(--muted-foreground)]">{label}</p>
        <p className="text-2xl font-semibold text-[var(--foreground)]">{value}</p>
      </div>
    </div>
  );
}
