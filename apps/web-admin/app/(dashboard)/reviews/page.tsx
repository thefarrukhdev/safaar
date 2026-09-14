"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminApi } from "@/lib/api/admin-api";
import type { AdminReview } from "@/types/admin";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { Star, ShieldAlert, CheckCircle2, Trash2, Eye } from "lucide-react";
import Modal from "@/components/ui/Modal";

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<AdminReview | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchReviews = async () => {
    try {
      const data = await AdminApi.getReviews();
      setReviews(data);
    } catch (error) {
      toast.error("Fikr-mulohazalarni yuklashda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  const handleStatusChange = async (id: string, newStatus: AdminReview['status']) => {
    try {
      await AdminApi.updateReviewStatus(id, newStatus);
      toast.success("Izoh holati yangilandi");
      setReviews(reviews.map((r) => (r.id === id ? { ...r, status: newStatus } : r)));
    } catch (error) {
      toast.error("Holatni o'zgartirishda xatolik yuz berdi");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Haqiqatan ham bu izohni o'chirmoqchimisiz?")) return;
    try {
      await AdminApi.deleteReview(id);
      toast.success("Izoh o'chirildi");
      setReviews(reviews.filter((r) => r.id !== id));
    } catch (error) {
      toast.error("O'chirishda xatolik yuz berdi");
    }
  };

  const columns: Column<AdminReview>[] = [
    {
      key: "hotelName",
      label: "Obyekt nomi",
      render: (row) => <div className="font-medium text-[var(--foreground)]">{row.hotelName}</div>,
      sortable: true,
    },
    {
      key: "userName",
      label: "Foydalanuvchi",
      render: (row) => <div className="text-[var(--muted-foreground)]">{row.userName}</div>,
    },
    {
      key: "rating",
      label: "Baho",
      render: (row) => (
        <div className="flex items-center gap-1">
          <Star size={14} className="fill-[var(--warning)] text-[var(--warning)]" />
          <span className="font-semibold">{row.rating}</span>
        </div>
      ),
      sortable: true,
    },
    {
      key: "comment",
      label: "Izoh",
      render: (row) => (
        <div className="max-w-xs truncate text-[var(--muted-foreground)]" title={row.comment}>
          {row.comment}
        </div>
      ),
    },
    {
      key: "status",
      label: "Holat",
      render: (row) => {
        switch (row.status) {
          case 'published':
            return <Badge color="#2ECC71" bg="rgba(46,204,113,0.12)">Nashr qilingan</Badge>;
          case 'hidden':
            return <Badge color="#F39C12" bg="rgba(243,156,18,0.12)">Yashiringan</Badge>;
          case 'spam':
            return <Badge color="#E74C3C" bg="rgba(231,76,60,0.12)">Spam</Badge>;
          default:
            return <Badge>{row.status}</Badge>;
        }
      },
    },
    {
      key: "actions",
      label: "Amallar",
      render: (row) => (
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSelectedReview(row);
              setIsModalOpen(true);
            }}
            title="Ko'rish"
          >
            <Eye size={16} />
          </Button>
          {row.status !== 'published' && (
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleStatusChange(row.id, 'published')}
              title="Tasdiqlash"
            >
              <CheckCircle2 size={16} />
            </Button>
          )}
          {row.status !== 'spam' && (
            <Button
              size="sm"
              variant="secondary"
              className="text-orange-500 hover:text-orange-600 hover:bg-orange-50"
              onClick={() => handleStatusChange(row.id, 'spam')}
              title="Spam deb belgilash"
            >
              <ShieldAlert size={16} />
            </Button>
          )}
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDelete(row.id)}
            title="O'chirish"
          >
            <Trash2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Fikr-mulohazalar moderatsiyasi</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Foydalanuvchilar qoldirgan sharhlar, baholar va spam xabarlarni tekshirish
          </p>
        </div>
      </div>

      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
          </div>
        ) : (
          <DataTable
            data={reviews}
            columns={columns}
            keyField="id"
            emptyMessage="Izohlar topilmadi"
          />
        )}
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="Izoh tafsilotlari"
        size="md"
      >
        {selectedReview && (
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase">Obyekt</label>
              <p className="font-semibold text-lg text-[var(--foreground)]">{selectedReview.hotelName}</p>
            </div>
            <div className="flex justify-between border-b border-[var(--border)] pb-4">
              <div>
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase">Mijoz</label>
                <p className="text-[var(--foreground)]">{selectedReview.userName}</p>
              </div>
              <div className="text-right">
                <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase">Baho</label>
                <div className="flex items-center gap-1 justify-end">
                  <Star size={16} className="fill-[var(--warning)] text-[var(--warning)]" />
                  <span className="font-bold text-lg">{selectedReview.rating} / 5</span>
                </div>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-[var(--muted-foreground)] uppercase mb-2 block">To'liq izoh matni</label>
              <div className="p-4 bg-gray-50 rounded-lg text-[var(--foreground)] italic">
                "{selectedReview.comment}"
              </div>
            </div>
            
            <div className="pt-4 flex justify-end gap-3 border-t border-[var(--border)]">
              <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Yopish</Button>
              <Button 
                variant="danger" 
                onClick={() => {
                  handleDelete(selectedReview.id);
                  setIsModalOpen(false);
                }}
              >
                O'chirish
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
