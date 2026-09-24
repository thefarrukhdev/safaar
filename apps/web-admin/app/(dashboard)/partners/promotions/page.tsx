'use client';

import { useEffect, useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { AdminApi, type PartnerPromotion } from '@/lib/api/admin-api';
import { formatDate, formatPrice } from '@/lib/utils';
import { toast } from 'sonner';

export default function PartnerPromotionsPage() {
  const [promotions, setPromotions] = useState<PartnerPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisionId, setDecisionId] = useState<string | null>(null);

  useEffect(() => {
    async function loadPromotions() {
      try {
        const data = await AdminApi.getPartnerPromotions();
        setPromotions(data);
      } catch (error) {
        toast.error('Chegirmalarni yuklashda xatolik yuz berdi');
      } finally {
        setLoading(false);
      }
    }
    loadPromotions();
  }, []);

  const handleDecision = async (id: string, decision: 'approve' | 'reject') => {
    setDecisionId(`${decision}:${id}`);
    try {
      if (decision === 'approve') {
        await AdminApi.approvePartnerPromotion(id);
        toast.success('Chegirma muvaffaqiyatli tasdiqlandi!');
        setPromotions(promotions.map(p => p.id === id ? { ...p, status: 'published' } : p));
      } else {
        await AdminApi.rejectPartnerPromotion(id);
        toast.success('Chegirma rad etildi!');
        setPromotions(promotions.map(p => p.id === id ? { ...p, status: 'rejected' } : p));
      }
    } catch {
      toast.error("Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.");
    } finally {
      setDecisionId(null);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[var(--text-primary)]">
            Chegirma arizalari
          </h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Hamkorlar tomonidan kiritilgan chegirmalarni ko'rib chiqish va tasdiqlash
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full text-sm whitespace-nowrap">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Hamkor
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Obyekt
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Narx (Eski / Yangi)
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Chegirma
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Muddat
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Holat
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                Amallar
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-light)]">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  Yuklanmoqda...
                </td>
              </tr>
            ) : promotions.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--text-muted)]">
                  Hech qanday chegirma arizalari topilmadi.
                </td>
              </tr>
            ) : (
              promotions.map((promo) => (
                <tr key={promo.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="px-4 py-3">
                    <span className="font-medium text-[var(--text-primary)]">
                      {promo.partnerName}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="font-medium text-[var(--text-primary)]">
                        {promo.entityName}
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        Turi: {promo.entityType === 'room' ? 'Xona' : 'Mashina'}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-xs text-[var(--text-muted)] line-through">
                        {formatPrice(promo.oldPriceSum)}
                      </span>
                      <span className="font-medium text-[var(--success)]">
                        {formatPrice(promo.newPriceSum)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-[var(--danger)]/10 px-2 py-0.5 text-xs font-medium text-[var(--danger)]">
                      -{promo.discountPercent}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                    {formatDate(promo.startDate)} - {formatDate(promo.endDate)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge
                      status={promo.status}
                      statusMap={{
                        pending_review: { label: 'Kutilmoqda', color: '#F39C12', bg: 'rgba(243,156,18,0.12)' },
                        published: { label: 'Tasdiqlangan', color: '#2ECC71', bg: 'rgba(46,204,113,0.12)' },
                        rejected: { label: 'Rad etilgan', color: '#E74C3C', bg: 'rgba(231,76,60,0.12)' },
                      }}
                    />
                  </td>
                  <td className="px-4 py-3">
                    {promo.status === 'pending_review' ? (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleDecision(promo.id, 'approve')}
                          loading={decisionId === `approve:${promo.id}`}
                          disabled={!!decisionId}
                        >
                          Tasdiqlash
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-[var(--danger)] hover:bg-[var(--danger)]/10 hover:text-[var(--danger)]"
                          onClick={() => handleDecision(promo.id, 'reject')}
                          loading={decisionId === `reject:${promo.id}`}
                          disabled={!!decisionId}
                        >
                          Rad etish
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-[var(--text-muted)]">Amal bajarilgan</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
