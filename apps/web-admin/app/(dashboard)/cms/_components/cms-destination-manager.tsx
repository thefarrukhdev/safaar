"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Edit2, Plus, Trash2, MapPin } from "lucide-react";
import type { CmsDestination } from "@/types/admin";
import { AdminApi } from "@/lib/api/admin-api";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";

export function CmsDestinationManager() {
  const [items, setItems] = useState<CmsDestination[]>([]);
  const [loading, setLoading] = useState(true);
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

  const openCreate = () => setEditingItem({ isActive: true, sortOrder: items.length + 1 });
  const openEdit = (item: CmsDestination) => setEditingItem({ ...item });

  const saveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    if (!editingItem.city || !editingItem.imageUrl) {
      toast.error("Shahar nomi va rasm manzilini kiriting");
      return;
    }

    try {
      if (editingItem.id) {
        await AdminApi.updateCmsDestination(editingItem.id, editingItem);
        toast.success("Yo'nalish saqlandi");
      } else {
        await AdminApi.createCmsDestination(editingItem);
        toast.success("Yangi yo'nalish qo'shildi");
      }
      setEditingItem(null);
      loadItems();
    } catch (err) {
      toast.error("Saqlashda xatolik");
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
    if (!confirm(`"${item.city}" o'chirilsinmi?`)) return;
    try {
      await AdminApi.deleteCmsDestination(item.id);
      toast.success("Yo'nalish o'chirildi");
      loadItems();
    } catch (err) {
      toast.error("O'chirishda xatolik");
    }
  };

  const columns: Column<CmsDestination>[] = [
    {
      key: "imageUrl",
      label: "Rasm",
      render: (row) => (
        <div className="w-12 h-12 rounded-lg bg-gray-100 overflow-hidden relative border border-[var(--border)]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={row.imageUrl} alt={row.city} className="w-full h-full object-cover" />
        </div>
      ),
    },
    {
      key: "city",
      label: "Shahar (Manzil)",
      render: (row) => <span className="font-medium">{row.city}</span>,
    },
    {
      key: "sortOrder",
      label: "Tartib",
      render: (row) => <span>{row.sortOrder}</span>,
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
            Bosh sahifadagi shahar va manzillarni boshqarish
          </p>
        </div>
        <Button icon={<Plus size={18} />} onClick={openCreate}>
          Yangi qo'shish
        </Button>
      </div>

      <DataTable
        data={items}
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
              label="Shahar nomi (Masalan: Toshkent)"
              value={editingItem.city || ""}
              onChange={(e) => setEditingItem({ ...editingItem, city: e.target.value })}
              required
            />
            
            <div>
              <label className="block text-sm font-medium mb-1">Rasm yuklash</label>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    const url = URL.createObjectURL(file);
                    setEditingItem({ ...editingItem, imageUrl: url });
                  }
                }}
                className="w-full text-sm text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)]/10 file:text-[var(--primary)] hover:file:bg-[var(--primary)]/20 cursor-pointer"
                required={!editingItem.imageUrl}
              />
            </div>
            {editingItem.imageUrl && (
              <div className="w-full h-32 rounded-xl overflow-hidden border border-dashed border-[var(--border)]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={editingItem.imageUrl} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}

            <Input
              label="Korsatilish tartibi (Sort Order)"
              type="number"
              value={editingItem.sortOrder?.toString() || "1"}
              onChange={(e) => setEditingItem({ ...editingItem, sortOrder: parseInt(e.target.value) || 1 })}
              required
            />

            <div className="flex gap-3 justify-end pt-4">
              <Button type="button" variant="secondary" onClick={() => setEditingItem(null)}>
                Bekor qilish
              </Button>
              <Button type="submit">Saqlash</Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
