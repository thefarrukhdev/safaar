"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Edit2, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { CmsDestination } from "@/types/admin";
import { AdminApi } from "@/lib/api/admin-api";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

function isSafeRelativeLink(value: string): boolean {
  // Faqat sayt ichidagi (`/`-prefiksli) yo'llar ruxsat etiladi — tashqi
  // domenlar yoki `javascript:`/`data:` kabi sxemalar XSS/open-redirect
  // xavfi tug'diradi, shuning uchun ular rad etiladi.
  return /^\/[^\s]*$/.test(value) && !value.startsWith("//");
}

export function CmsDestinationManager() {
  const [items, setItems] = useState<CmsDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Partial<CmsDestination> | null>(null);

  const loadItems = async () => {
    try {
      const result = await AdminApi.getCmsDestinations();
      setItems(result);
    } catch (err) {
      toast.error("Yo'nalishlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const openCreate = () =>
    setEditingItem({ isActive: true, order: items.length + 1, link: "/" });
  const openEdit = (item: CmsDestination) => setEditingItem({ ...item });

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const result = await AdminApi.uploadImage(file);
      setEditingItem((prev) => (prev ? { ...prev, imageUrl: result.url } : prev));
    } catch (err) {
      toast.error("Rasm yuklashda xatolik");
    } finally {
      setUploading(false);
    }
  };

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editingItem.title || !editingItem.imageUrl) {
      toast.error("Nom va rasmni kiriting");
      return;
    }
    const link = (editingItem.link || "/").trim();
    if (!isSafeRelativeLink(link)) {
      setLinkError("Havola faqat \"/\" bilan boshlanishi kerak (masalan: /uz/hotels?city_id=toshkent)");
      return;
    }
    setLinkError(null);

    setSaving(true);
    try {
      if (editingItem.id) {
        await AdminApi.updateCmsDestination(editingItem.id, { ...editingItem, link });
        toast.success("Yo'nalish saqlandi");
      } else {
        await AdminApi.createCmsDestination({
          title: editingItem.title,
          imageUrl: editingItem.imageUrl,
          link,
          isActive: editingItem.isActive ?? true,
          order: editingItem.order ?? items.length + 1,
        });
        toast.success("Yangi yo'nalish qo'shildi");
      }
      setEditingItem(null);
      loadItems();
    } catch (err) {
      toast.error("Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: CmsDestination) => {
    try {
      await AdminApi.setCmsDestinationStatus(item.id, !item.isActive);
      toast.success("Holat o'zgartirildi");
      loadItems();
    } catch (err) {
      toast.error("Holatni o'zgartirishda xatolik");
    }
  };

  const deleteItem = async (item: CmsDestination) => {
    if (!confirm(`"${item.title}" o'chirilsinmi?`)) return;
    try {
      await AdminApi.deleteCmsDestination(item.id);
      toast.success("Yo'nalish o'chirildi");
      loadItems();
    } catch (err) {
      toast.error("O'chirishda xatolik");
    }
  };

  const move = async (item: CmsDestination, direction: -1 | 1) => {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((row) => row.id === item.id);
    const swapWith = sorted[index + direction];
    if (!swapWith) return;

    try {
      await Promise.all([
        AdminApi.updateCmsDestination(item.id, { order: swapWith.order }),
        AdminApi.updateCmsDestination(swapWith.id, { order: item.order }),
      ]);
      loadItems();
    } catch (err) {
      toast.error("Tartibni o'zgartirishda xatolik");
    }
  };

  const columns: Column<CmsDestination>[] = [
    {
      key: "imageUrl",
      label: "Rasm",
      render: (row) => (
        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden relative border border-[var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.imageUrl} alt={row.title} className="w-full h-full object-cover" />
        </div>
      ),
    },
    {
      key: "title",
      label: "Nomi",
      render: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "link",
      label: "Havola",
      render: (row) => (
        <span className="text-xs text-[var(--text-muted)] font-mono">{row.link}</span>
      ),
    },
    {
      key: "order",
      label: "Tartib",
      render: (row) => (
        <div className="flex items-center gap-1">
          <span className="w-5 text-center">{row.order}</span>
          <button
            type="button"
            onClick={() => move(row, -1)}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
            aria-label="Yuqoriga"
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => move(row, 1)}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
            aria-label="Pastga"
          >
            <ArrowDown size={14} />
          </button>
        </div>
      ),
    },
    {
      key: "isActive",
      label: "Holat",
      render: (row) => (
        <button
          type="button"
          onClick={() => toggleStatus(row)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            row.isActive
              ? "bg-[var(--success)]/10 text-[var(--success)] hover:bg-[var(--success)]/20"
              : "bg-[var(--warning)]/10 text-[var(--warning)] hover:bg-[var(--warning)]/20"
          }`}
        >
          {row.isActive ? "Faol" : "Yashirin"}
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
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10 transition-colors"
          >
            <Edit2 size={16} />
          </button>
          <button
            type="button"
            onClick={() => deleteItem(row)}
            className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Mashhur yo'nalishlar</h1>
          <p className="text-[var(--text-secondary)] mt-1">
            Bosh sahifadagi "Mashhur yo'nalishlar" blokini boshqarish
          </p>
        </div>
        <Button icon={<Plus size={18} />} onClick={openCreate}>
          Yangi qo'shish
        </Button>
      </div>

      <DataTable
        data={[...items].sort((a, b) => a.order - b.order)}
        columns={columns}
        isLoading={loading}
        keyField="id"
        emptyMessage="Hozircha yo'nalishlar yo'q"
      />

      {editingItem && (
        <Modal
          open={true}
          onClose={() => setEditingItem(null)}
          title={editingItem.id ? "Yo'nalishni tahrirlash" : "Yangi yo'nalish qo'shish"}
        >
          <form onSubmit={saveItem} className="space-y-4">
            <Input
              label="Nomi (Masalan: Toshkent)"
              value={editingItem.title || ""}
              onChange={(e) => setEditingItem({ ...editingItem, title: e.target.value })}
              required
            />

            <div>
              <label className="block text-sm font-medium mb-1">Rasm yuklash</label>
              <input
                type="file"
                accept="image/*"
                disabled={uploading}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
                className="w-full text-sm text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)]/10 file:text-[var(--primary)] hover:file:bg-[var(--primary)]/20 cursor-pointer disabled:opacity-50"
                required={!editingItem.imageUrl}
              />
              {uploading && (
                <p className="text-xs text-[var(--text-muted)] mt-1">Yuklanmoqda...</p>
              )}
            </div>
            {editingItem.imageUrl && (
              <div className="w-full h-32 rounded-xl overflow-hidden border border-dashed border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={editingItem.imageUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            <Input
              label="Havola (bosilganda ochiladigan sahifa)"
              placeholder="/uz/hotels?city_id=toshkent"
              value={editingItem.link ?? ""}
              onChange={(e) => {
                setEditingItem({ ...editingItem, link: e.target.value });
                if (linkError) setLinkError(null);
              }}
              error={linkError ?? undefined}
              required
            />

            <Input
              label="Ko'rsatilish tartibi"
              type="number"
              value={editingItem.order?.toString() || "1"}
              onChange={(e) => setEditingItem({ ...editingItem, order: parseInt(e.target.value) || 1 })}
              required
            />

            <div className="flex gap-3 justify-end pt-4">
              <Button type="button" variant="secondary" onClick={() => setEditingItem(null)}>
                Bekor qilish
              </Button>
              <Button type="submit" loading={saving} disabled={uploading}>
                Saqlash
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
