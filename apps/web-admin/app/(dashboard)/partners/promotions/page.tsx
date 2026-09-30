'use client';

import { useEffect, useState } from 'react';
import { Trash2, Clock, AlertTriangle, X } from 'lucide-react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import StatusBadge from '@/components/ui/StatusBadge';
import { AdminApi, type PartnerPromotion } from '@/lib/api/admin-api';
import { formatDate, formatPrice } from '@/lib/utils';
import { toast } from 'sonner';

/** Confirmation modal komponenti */
function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  loading,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  loading: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <X className="h-5 w-5" />
        </button>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
            <AlertTriangle className="h-5 w-5 text-red-500" />
          </div>
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">{title}</h2>
        </div>
        <p className="mb-6 text-sm text-[var(--text-secondary)]">{description}</p>
        <div className="flex justify-end gap-3">
          <Button variant="ghost" size="sm" onClick={onClose} disabled={loading}>
            Bekor qilish
          </Button>
          <Button
            size="sm"
            className="bg-red-500 text-white hover:bg-red-600"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function PartnerPromotionsPage() {
  const [promotions, setPromotions] = useState<PartnerPromotion[]>([]);
  const [loading, setLoading] = useState(true);
  const [decisionId, setDecisionId] = useState<string | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ type: 'single'; id: string } | { type: 'expired' } | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    loadPromotions();
  }, []);

  async function loadPromotions() {
    try {
      setLoading(true);
      const data = await AdminApi.getPartnerPromotions();
      setPromotions(data);
    } catch {
      toast.error('Chegirmalarni yuklashda xatolik yuz berdi');
    } finally {
      setLoading(false);
    }
  }

  const handleDecision = async (id: string, decision: 'approve' | 'reject') => {
    setDecisionId(`${decision}:${id}`);
    try {
      const updated =
        decision === 'approve'
          ? await AdminApi.approvePartnerPromotion(id)
          : await AdminApi.rejectPartnerPromotion(id);
      toast.success(
        decision === 'approve' ? 'Chegirma muvaffaqiyatli tasdiqlandi!' : 'Chegirma rad etildi!',
      );
      // Row is updated from the real backend response, not a local guess.
      setPromotions((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch (error: any) {
      const code = error?.response?.data?.error?.code;
      const backendMessage = error?.response?.data?.error?.message;
      if (error?.response?.status === 404) {
        toast.error('Chegirma topilmadi — ro\'yxat allaqachon eskirgan bo\'lishi mumkin.');
      } else if (code === 'PROMOTION_ALREADY_DECIDED') {
        toast.error(backendMessage || 'Bu chegirma allaqachon ko\'rib chiqilgan.');
        // Re-sync with the backend so the stale row doesn't keep showing
        // the now-wrong "Kutilmoqda" action buttons.
        AdminApi.getPartnerPromotions().then(setPromotions).catch(() => {});
      } else if (error?.response?.status === 401 || error?.response?.status === 403) {
        toast.error('Bu amal uchun ruxsatingiz yo\'q.');
      } else {
        toast.error(backendMessage || "Xatolik yuz berdi. Iltimos qaytadan urinib ko'ring.");
      }
    } finally {
      setDecisionId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleteLoading(true);
    try {
      if (deleteModal.type === 'single') {
        await AdminApi.deletePartnerPromotion(deleteModal.id);
        setPromotions(prev => prev.filter(p => p.id !== deleteModal.id));
        toast.success("Chegirma o'chirildi!");
      } else {
        // Vaqti o'tgan promotionlarni aniqlash va barchasini o'chirish
        const today = new Date().toISOString().split('T')[0];
        const expired = promotions.filter(p => p.endDate < today);
        if (expired.length === 0) {
          toast.info("Vaqti o'tgan chegirmalar topilmadi.");
          setDeleteModal(null);
          return;
        }
        let deletedCount = 0;
        for (const promo of expired) {
          try {
            await AdminApi.deletePartnerPromotion(promo.id);
            deletedCount++;
          } catch {
            // Birini o'chirishda xato bo'lsa davom etaveradi
          }
        }
        setPromotions(prev => prev.filter(p => p.endDate >= today));
        toast.success(`${deletedCount} ta vaqti o'tgan chegirma o'chirildi!`);
      }
    } catch {
      toast.error("O'chirishda xatolik yuz berdi.");
    } finally {
      setDeleteLoading(false);
      setDeleteModal(null);
    }
  };

  const today = new Date().toISOString().split('T')[0];
  const expiredCount = promotions.filter(p => p.endDate < today).length;

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
        {expiredCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="flex items-center gap-2 text-amber-600 hover:bg-amber-50 hover:text-amber-700 border border-amber-200"
            onClick={() => setDeleteModal({ type: 'expired' })}
          >
            <Clock className="h-4 w-4" />
            Vaqti o'tganlarni o'chir ({expiredCount})
          </Button>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
        <table className="w-full text-sm">
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
              <th className="px-3 py-3 text-right text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wider">
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
              promotions.map((promo) => {
                const isExpired = promo.endDate < today;
                return (
                  <tr
                    key={promo.id}
                    className={`hover:bg-[var(--bg-tertiary)] transition-colors ${isExpired ? 'opacity-60' : ''}`}
                  >
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
                      <div className="flex flex-col gap-0.5">
                        <span>{formatDate(promo.startDate)} - {formatDate(promo.endDate)}</span>
                        {isExpired && (
                          <span className="text-xs font-medium text-amber-500 flex items-center gap-1">
                            <Clock className="h-3 w-3" /> Vaqti o'tgan
                          </span>
                        )}
                      </div>
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
                    <td className="px-3 py-3">
                      <div className="flex items-center justify-end gap-1 whitespace-nowrap">
                        {promo.status === 'pending_review' ? (
                          <>
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
                          </>
                        ) : (
                          <span className="text-xs text-[var(--text-muted)]">Amal bajarilgan</span>
                        )}
                        <button
                          className="ml-1 rounded-lg p-1.5 text-[var(--text-muted)] transition-colors hover:bg-red-50 hover:text-red-500"
                          title="O'chirish"
                          onClick={() => setDeleteModal({ type: 'single', id: promo.id })}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation modal */}
      <ConfirmModal
        open={!!deleteModal}
        title={
          deleteModal?.type === 'expired'
            ? "Vaqti o'tgan chegirmalarni o'chirish"
            : "Chegirmani o'chirish"
        }
        description={
          deleteModal?.type === 'expired'
            ? `Vaqti o'tgan ${expiredCount} ta chegirma o'chiriladi. Bu chegirmalar web-user saytida ham ko'rinmay qoladi. Davom etasizmi?`
            : "Bu chegirmani o'chirsangiz, web-user saytida ham ko'rinmay qoladi. Bu amalni qaytarib bo'lmaydi. Davom etasizmi?"
        }
        confirmLabel="Ha, o'chirish"
        loading={deleteLoading}
        onConfirm={handleDelete}
        onClose={() => !deleteLoading && setDeleteModal(null)}
      />
    </div>
  );
}
