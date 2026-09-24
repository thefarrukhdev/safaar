"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Edit2, Plus, Trash2, ArrowUp, ArrowDown } from "lucide-react";
import type { CmsAttraction } from "@/types/admin";
import { AdminApi } from "@/lib/api/admin-api";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

export function CmsAttractionManager() {
  const [items, setItems] = useState<CmsAttraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<CmsAttraction> | null>(null);

  const loadItems = async () => {
    try {
      const result = await AdminApi.getCmsAttractions();
      setItems(result);
    } catch (err) {
      toast.error("Attraksionlarni yuklashda xatolik");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
  }, []);

  const openCreate = () =>
    setEditingItem({ isActive: true, order: items.length + 1, categoryKey: 'historical' });
  const openEdit = (item: CmsAttraction) => setEditingItem({ ...item });

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
    if (!editingItem?.name || !editingItem.imageUrl || !editingItem.cityName) {
      toast.error("Barcha majburiy maydonlarni to'ldiring");
      return;
    }

    setSaving(true);
    try {
      if (editingItem.id) {
        await AdminApi.updateCmsAttraction(editingItem.id, editingItem);
        toast.success("Muvaffaqiyatli saqlandi");
      } else {
        await AdminApi.createCmsAttraction(editingItem as Omit<CmsAttraction, "id">);
        toast.success("Muvaffaqiyatli yaratildi");
      }
      setEditingItem(null);
      loadItems();
    } catch (err) {
      toast.error("Saqlashda xatolik");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Haqiqatan ham o'chirmoqchimisiz?")) return;
    try {
      await AdminApi.deleteCmsAttraction(id);
      toast.success("O'chirildi");
      loadItems();
    } catch (err) {
      toast.error("O'chirishda xatolik");
    }
  };

  const toggleStatus = async (item: CmsAttraction) => {
    try {
      await AdminApi.updateCmsAttraction(item.id, { isActive: !item.isActive });
      toast.success("Holat o'zgartirildi");
      loadItems();
    } catch (err) {
      toast.error("Holatni o'zgartirishda xatolik");
    }
  };

  const move = async (item: CmsAttraction, direction: -1 | 1) => {
    const sorted = [...items].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((row) => row.id === item.id);
    const swapWith = sorted[index + direction];
    if (!swapWith) return;

    try {
      await Promise.all([
        AdminApi.updateCmsAttraction(item.id, { order: swapWith.order }),
        AdminApi.updateCmsAttraction(swapWith.id, { order: item.order }),
      ]);
      loadItems();
    } catch (err) {
      toast.error("Tartibni o'zgartirishda xatolik");
    }
  };

  const columns: Column<CmsAttraction>[] = [
    {
      key: "imageUrl",
      label: "Rasm",
      render: (row) => (
        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden relative border border-[var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.imageUrl} alt={row.name} className="w-full h-full object-cover" />
        </div>
      ),
    },
    {
      key: "name",
      label: "Nomi",
      render: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      key: "cityName",
      label: "Shahar",
      render: (row) => <span className="text-sm">{row.cityName}</span>,
    },
    {
      key: "categoryKey",
      label: "Kategoriya",
      render: (row) => <span className="text-sm px-2 py-1 bg-gray-100 rounded-md border border-gray-200">{row.categoryKey}</span>,
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
          >
            <ArrowUp size={14} />
          </button>
          <button
            type="button"
            onClick={() => move(row, 1)}
            className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--primary)] hover:bg-[var(--primary)]/10"
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
          onClick={() => toggleStatus(row)}
          className={`px-2.5 py-1 text-xs font-medium rounded-full ${
            row.isActive
              ? "bg-green-100 text-green-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {row.isActive ? "Faol" : "Faol emas"}
        </button>
      ),
    },
    {
      key: "actions",
      label: "Amallar",
      className: "text-right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={() => openEdit(row)}
            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
          >
            <Edit2 size={16} />
          </button>
          <button
            onClick={() => handleDelete(row.id)}
            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
          >
            <Trash2 size={16} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Ko'ngilochar joylar</h1>
        <Button onClick={openCreate} className="gap-2">
          <Plus size={16} />
          Qo'shish
        </Button>
      </div>

      <DataTable
        data={items.sort((a, b) => a.order - b.order)}
        columns={columns}
        keyField="id"
        isLoading={loading}
        emptyMessage="Joylar topilmadi"
      />

      <Modal
        open={!!editingItem}
        onClose={() => !saving && setEditingItem(null)}
        title={editingItem?.id ? "Joyni tahrirlash" : "Yangi joy"}
      >
        <form onSubmit={saveItem} className="space-y-4">
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium mb-1">Rasm yuklash</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                }}
                className="w-full text-sm"
                disabled={uploading}
              />
              {uploading && <p className="text-sm text-blue-600 mt-1">Yuklanmoqda...</p>}
              {editingItem?.imageUrl && (
                <div className="mt-2 w-32 h-24 rounded-lg bg-gray-100 overflow-hidden relative border border-[var(--border)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={editingItem.imageUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
            </div>

            <Input
              label="Nomi"
              value={editingItem?.name || ""}
              onChange={(e) => setEditingItem({ ...editingItem!, name: e.target.value })}
              required
            />
            <Input
              label="Shahar"
              value={editingItem?.cityName || ""}
              onChange={(e) => setEditingItem({ ...editingItem!, cityName: e.target.value })}
              required
            />
            
            <div className="grid grid-cols-2 gap-4">
              <Input
                type="number"
                step="any"
                label="Kenglik (Latitude)"
                value={editingItem?.latitude || ""}
                onChange={(e) => setEditingItem({ ...editingItem!, latitude: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Masalan: 41.2995"
              />
              <Input
                type="number"
                step="any"
                label="Uzunlik (Longitude)"
                value={editingItem?.longitude || ""}
                onChange={(e) => setEditingItem({ ...editingItem!, longitude: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Masalan: 69.2401"
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-sm font-medium">Kategoriya</label>
              <select 
                value={editingItem?.categoryKey || 'historical'}
                onChange={(e) => setEditingItem({ ...editingItem!, categoryKey: e.target.value })}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="historical">Tarixiy Obida</option>
                <option value="unesco">UNESCO Merosi</option>
                <option value="nature">Tabiat & Hordiq</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-sm font-medium">Tavsif</label>
              <textarea
                value={editingItem?.description || ""}
                onChange={(e) => setEditingItem({ ...editingItem!, description: e.target.value })}
                className="w-full px-3 py-2 border rounded-md min-h-[100px]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingItem(null)}
              disabled={saving}
            >
              Bekor qilish
            </Button>
            <Button type="submit" disabled={saving || uploading}>
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
