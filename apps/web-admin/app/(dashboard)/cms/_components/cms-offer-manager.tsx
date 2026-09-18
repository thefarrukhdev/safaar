"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Eye, Edit2, Plus, Send, FileText, Trash2 } from "lucide-react";
import type { CmsArticle } from "@/types/admin";
import { AdminApi } from "@/lib/api/admin-api";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";

export function CmsOfferManager() {
  const [items, setItems] = useState<CmsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingItem, setEditingItem] = useState<Partial<CmsArticle> | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const loadItems = async () => {
    try {
      const result = await AdminApi.getCmsOffers();
      setItems(result);
    } catch (err) {
      toast.error("Takliflarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const openCreate = () => setEditingItem({ type: "offer", status: "draft", metadata: {} });
  const openEdit = (item: CmsArticle) => setEditingItem({ ...item, metadata: item.metadata || {} });

  const saveItem = async () => {
    if (!editingItem) return;

    const titleValue = editingItem.title?.trim();
    const slugValue = editingItem.slug?.trim() || "offer-" + Date.now().toString().slice(-6);

    if (!titleValue) {
      toast.error("Sarlavhani kiriting");
      return;
    }

    try {
      if (editingItem.id) {
        await AdminApi.updateCmsOffer(editingItem.id, {
          title: titleValue,
          slug: slugValue,
          metadata: editingItem.metadata,
        });
        toast.success("Taklif saqlandi");
      } else {
        await AdminApi.createCmsOffer({
          title: titleValue,
          slug: slugValue,
          type: "offer",
          status: editingItem.status as "published" | "draft",
          publishedAt: "",
          metadata: editingItem.metadata,
        });
        toast.success("Yangi taklif yaratildi");
      }
      setEditingItem(null);
      loadItems();
    } catch (err) {
      toast.error("Saqlashda xatolik");
    }
  };

  const toggleStatus = async (item: CmsArticle) => {
    const nextStatus = item.status === "published" ? "draft" : "published";
    try {
      await AdminApi.setCmsOfferStatus(item.id, nextStatus);
      toast.success("Holat o'zgartirildi");
      loadItems();
    } catch (err) {
      toast.error("Holatni o'zgartirishda xatolik");
    }
  };

  const deleteItem = async (item: CmsArticle) => {
    if (!confirm(`"${item.title}" o'chirilsinmi?`)) return;
    try {
      await AdminApi.deleteCmsOffer(item.id);
      toast.success("Taklif o'chirildi");
      loadItems();
    } catch (err) {
      toast.error("O'chirishda xatolik");
    }
  };

  const columns: Column<CmsArticle>[] = [
    {
      key: "title",
      label: "Sarlavha",
      render: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "hotel_id",
      label: "Mehmonxona ID",
      render: (row) => <span className="text-xs text-[var(--text-muted)]">{row.metadata?.hotel_id || "—"}</span>,
    },
    {
      key: "prices",
      label: "Narx",
      render: (row) => (
        <span className="text-sm">
          {row.metadata?.new_price ? `${row.metadata.new_price} so'm` : "—"}
        </span>
      ),
    },
    {
      key: "discount",
      label: "Chegirma",
      render: (row) => (
        <span className="text-sm text-green-600">
          {row.metadata?.discount_percent ? `${row.metadata.discount_percent}%` : "—"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Holat",
      render: (row) => (
        <button
          type="button"
          onClick={() => toggleStatus(row)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            row.status === "published"
              ? "bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20"
              : "bg-[var(--warning)]/10 text-[var(--warning)] hover:bg-[var(--warning)]/20"
          }`}
        >
          {row.status === "published" ? "Chop etilgan" : "Qoralama"}
        </button>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => openEdit(row)}
            title="Tahrirlash"
            className="w-8 h-8 rounded flex items-center justify-center text-[var(--primary)] hover:bg-[var(--primary)]/10"
          >
            <Edit2 size={14} />
          </button>
          <button
            type="button"
            onClick={() => deleteItem(row)}
            title="O'chirish"
            className="w-8 h-8 rounded flex items-center justify-center text-[var(--danger)] hover:bg-[var(--danger)]/10"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <span className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Chegirmadagi takliflar</h1>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus size={16} />
          Taklif qo'shish
        </Button>
      </div>

      <DataTable
        data={items}
        columns={columns}
        keyField="id"
        emptyMessage="Hozircha chegirmalar qo'shilmagan"
      />

      <Modal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        title={editingItem?.id ? "Taklifni tahrirlash" : "Yangi taklif"}
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">Sarlavha (Kortej ustidagi yozuv)</label>
            <Input
              value={editingItem?.title ?? ""}
              onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
              placeholder="Masalan: Hilton Tashkent"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium">URL (slug)</label>
            <Input
              value={editingItem?.slug ?? ""}
              onChange={(e) => setEditingItem({ ...editingItem, slug: e.target.value })}
              placeholder="hilton-tashkent-deal"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">Hotel ID (Majburiy)</label>
              <Input
                value={editingItem?.metadata?.hotel_id ?? ""}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    metadata: { ...editingItem?.metadata, hotel_id: e.target.value },
                  })
                }
                placeholder="00000000-..."
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Rasm yuklash</label>
              <input
                type="file"
                accept="image/*"
                disabled={uploadingImage}
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  setUploadingImage(true);
                  try {
                    const uploaded = await AdminApi.uploadImage(file);
                    setEditingItem((prev) => ({
                      ...prev,
                      metadata: { ...prev?.metadata, image_url: uploaded.url },
                    }));
                  } catch {
                    toast.error("Rasm yuklashda xatolik yuz berdi");
                  } finally {
                    setUploadingImage(false);
                  }
                }}
                className="w-full text-sm text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)]/10 file:text-[var(--primary)] hover:file:bg-[var(--primary)]/20 cursor-pointer"
              />
              {uploadingImage && (
                <div className="mt-2 text-xs text-[var(--text-muted)]">Yuklanmoqda...</div>
              )}
              {!uploadingImage && editingItem?.metadata?.image_url && (
                <div className="mt-2 text-xs text-[var(--success)]">Rasm tanlandi</div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium">Eski narx (so'm)</label>
              <Input
                type="number"
                value={editingItem?.metadata?.old_price ?? ""}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    metadata: { ...editingItem?.metadata, old_price: Number(e.target.value) },
                  })
                }
                placeholder="65000000"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Yangi narx (so'm)</label>
              <Input
                type="number"
                value={editingItem?.metadata?.new_price ?? ""}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    metadata: { ...editingItem?.metadata, new_price: Number(e.target.value) },
                  })
                }
                placeholder="52000000"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium">Chegirma (%)</label>
              <Input
                type="number"
                value={editingItem?.metadata?.discount_percent ?? ""}
                onChange={(e) =>
                  setEditingItem({
                    ...editingItem,
                    metadata: { ...editingItem?.metadata, discount_percent: Number(e.target.value) },
                  })
                }
                placeholder="20"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-[var(--border)]">
            <Button variant="secondary" onClick={() => setEditingItem(null)}>
              Bekor qilish
            </Button>
            <Button onClick={saveItem} disabled={uploadingImage} className="gap-2">
              <Send size={16} />
              Saqlash
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
