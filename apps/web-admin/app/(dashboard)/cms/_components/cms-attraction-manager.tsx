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
import Drawer from "@/components/ui/Drawer";
import dynamic from "next/dynamic";
import { UploadCloud } from "lucide-react";

// Map ni CSR da yuklash uchun (SSR xato bermasligi uchun)
const LocationPickerMap = dynamic(
  () => import("./LocationPickerMap").then((mod) => mod.LocationPickerMap),
  { ssr: false, loading: () => <div className="h-[300px] w-full bg-gray-100 animate-pulse rounded-lg flex items-center justify-center text-sm text-gray-500">Xarita yuklanmoqda...</div> }
);

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

      <Drawer
        open={!!editingItem}
        onClose={() => !saving && setEditingItem(null)}
        title={editingItem?.id ? "Joyni tahrirlash" : "Yangi joy qo'shish"}
        width="max-w-4xl"
      >
        <form onSubmit={saveItem} className="flex flex-col h-full">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Details */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">Asosiy ma'lumotlar</h3>
                <div className="space-y-4">
                  <Input
                    label="Nomi"
                    value={editingItem?.name || ""}
                    onChange={(e) => setEditingItem({ ...editingItem!, name: e.target.value })}
                    required
                  />
                  <Input
                    label="Shahar (Manzil)"
                    value={editingItem?.cityName || ""}
                    onChange={(e) => setEditingItem({ ...editingItem!, cityName: e.target.value })}
                    required
                  />
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Kategoriya</label>
                    <select 
                      value={editingItem?.categoryKey || 'historical'}
                      onChange={(e) => setEditingItem({ ...editingItem!, categoryKey: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      <option value="historical">Tarixiy Obida</option>
                      <option value="unesco">UNESCO Merosi</option>
                      <option value="nature">Tabiat & Hordiq</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Tavsif (Batafsil ma'lumot)</label>
                    <textarea
                      value={editingItem?.description || ""}
                      onChange={(e) => setEditingItem({ ...editingItem!, description: e.target.value })}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-lg shadow-sm min-h-[160px] focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="Joy haqida qiziqarli ma'lumotlar..."
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Media and Location */}
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">Rasm yuklash</h3>
                <label className="relative flex flex-col items-center justify-center w-full h-40 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-xl cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors overflow-hidden group">
                  {editingItem?.imageUrl ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={editingItem.imageUrl} alt="Preview" className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white text-sm font-medium">Boshqa rasm yuklash</span>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                      <p className="mb-1 text-sm text-slate-500"><span className="font-semibold text-blue-600">Bosing</span> yoki rasmni shu yerga tashlang</p>
                      <p className="text-xs text-slate-400">PNG, JPG or WEBP (Max. 5MB)</p>
                    </div>
                  )}
                  <input 
                    type="file" 
                    className="hidden" 
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(file);
                    }}
                    disabled={uploading}
                  />
                  {uploading && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    </div>
                  )}
                </label>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2 mb-4">Xaritadagi joylashuvi</h3>
                <div className="bg-slate-50 dark:bg-slate-800/30 p-1 rounded-xl border border-slate-200 dark:border-slate-800 shadow-inner">
                  <LocationPickerMap 
                    latitude={editingItem?.latitude}
                    longitude={editingItem?.longitude}
                    onChange={(lat, lng) => setEditingItem({ ...editingItem!, latitude: lat, longitude: lng })}
                  />
                </div>
                <div className="flex gap-4 mt-3 text-xs text-slate-500 dark:text-slate-400 justify-center">
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-700 dark:text-slate-300">Lat:</strong> {editingItem?.latitude?.toFixed(5) || 'Tanlanmagan'}
                  </span>
                  <span className="bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700">
                    <strong className="text-slate-700 dark:text-slate-300">Lng:</strong> {editingItem?.longitude?.toFixed(5) || 'Tanlanmagan'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-200 dark:border-slate-800">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditingItem(null)}
              disabled={saving}
              className="px-6"
            >
              Bekor qilish
            </Button>
            <Button type="submit" disabled={saving || uploading} className="px-8 shadow-md">
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </div>
        </form>
      </Drawer>
    </div>
  );
}
