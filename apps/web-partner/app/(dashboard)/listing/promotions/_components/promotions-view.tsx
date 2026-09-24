"use client";

import { useState, useEffect } from "react";
import { Plus, Tag } from "lucide-react";
import { Button } from "../../../../_components/ui/button";
import { PageHeader } from "../../../../_components/layout/page-header";
import { EmptyState, LoadingState } from "../../../../_components/ui/empty-state";
import { promotions, type Promotion } from "../../../../_lib/api/endpoints/promotions";
import { RoomPromotionDialog } from "../_dialogs/room-promotion-dialog";
import { formatMoney } from "../../../../_lib/utils/format";
import { useAuthStore } from "../../../../_stores/auth-store";
import { Badge } from "../../../../_components/ui/badge";

export function PromotionsView() {
  const hotelId = useAuthStore((s) => s.user?.organizationId || "mock-hotel-id");
  const [data, setData] = useState<Promotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadPromotions = async () => {
    try {
      setLoading(true);
      const res = await promotions.getPromotions(hotelId);
      setData(res);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPromotions();
  }, [hotelId]);

  const handleAdded = () => {
    loadPromotions();
  };

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          eyebrow="Sotuv"
          title="Chegirmalarim"
          description="E'lon qilingan xonalar yoki mashinalar uchun maxsus chegirmalar o'rnatish."
        />
        <div className="mt-4 sm:mt-0">
          <Button onClick={() => setDialogOpen(true)}>
            <Tag className="mr-2 h-4 w-4" />
            Yangi chegirma qo'shish
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-10">
        {loading ? (
          <LoadingState title="Chegirmalar yuklanmoqda..." />
        ) : data.length === 0 ? (
          <EmptyState
            icon={<Tag className="w-12 h-12 text-[var(--muted-foreground)]" />}
            title="Chegirmalar yo'q"
            description="Hozircha hech qanday chegirma e'lon qilinmagan."
            action={
              <Button onClick={() => setDialogOpen(true)}>
                Chegirma qo'shish
              </Button>
            }
          />
        ) : (
          <div className="bg-[var(--surface)] ring-1 ring-[var(--border)] sm:rounded-xl overflow-hidden">
            <table className="min-w-full divide-y divide-[var(--border)]">
              <thead className="bg-[var(--surface-muted)]">
                <tr>
                  <th className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-[var(--foreground)]">Obyekt</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-[var(--foreground)]">Eski Narx</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-[var(--foreground)]">Chegirmali Narx</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-[var(--foreground)]">Foiz</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-[var(--foreground)]">Amal qilish muddati</th>
                  <th className="px-3 py-3.5 text-left text-sm font-semibold text-[var(--foreground)]">Holati</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {data.map((item) => (
                  <tr key={item.id} className="hover:bg-[var(--surface-hover)] transition-colors">
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-[var(--foreground)]">
                      {item.entityName}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted-foreground)] line-through">
                      {formatMoney(item.oldPriceSum)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                      {formatMoney(item.newPriceSum)}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-rose-500">
                      -{item.discountPercent}%
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-[var(--muted-foreground)]">
                      {item.startDate} — {item.endDate}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                      {item.status === 'pending_review' && <Badge tone="warning">Kutilmoqda</Badge>}
                      {item.status === 'published' && <Badge tone="accent">Tasdiqlangan</Badge>}
                      {item.status === 'rejected' && <Badge tone="danger">Rad etilgan</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RoomPromotionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSuccess={handleAdded}
      />
    </div>
  );
}
