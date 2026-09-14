"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminApi } from "@/lib/api/admin-api";
import type { AdminBanner } from "@/types/admin";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Plus, Edit2, Trash2, Save, Image as ImageIcon } from "lucide-react";
import Image from "next/image";

export default function BannersPage() {
  const [items, setItems] = useState<AdminBanner[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminBanner | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const fetchBanners = async () => {
    try {
      const data = await AdminApi.getBanners();
      setItems(data);
    } catch (error) {
      toast.error("Bannerlarni yuklashda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleEdit = (item: AdminBanner) => {
    setEditingItem(item);
    setTitle(item.title);
    setImageUrl(item.imageUrl);
    setIsActive(item.isActive);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setTitle("");
    setImageUrl("");
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Haqiqatan ham bu bannerni o'chirmoqchimisiz?")) return;
    try {
      await AdminApi.deleteBanner(id);
      toast.success("Banner o'chirildi");
      setItems(items.filter((t) => t.id !== id));
    } catch (error) {
      toast.error("O'chirishda xatolik yuz berdi");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { title, imageUrl, isActive };
      if (editingItem) {
        const updated = await AdminApi.updateBanner(editingItem.id, payload);
        setItems(items.map((t) => (t.id === updated.id ? updated : t)));
        toast.success("Banner yangilandi");
      } else {
        const created = await AdminApi.createBanner(payload);
        setItems([created, ...items]);
        toast.success("Yangi banner qo'shildi");
      }
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<AdminBanner>[] = [
    {
      key: "imageUrl",
      label: "Rasm",
      render: (row) => (
        <div className="relative w-24 h-12 rounded overflow-hidden bg-gray-100 border border-[var(--border)]">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt={row.title} className="object-cover w-full h-full" />
          ) : (
            <div className="flex items-center justify-center w-full h-full text-gray-400">
              <ImageIcon size={16} />
            </div>
          )}
        </div>
      ),
    },
    {
      key: "title",
      label: "Sarlavha",
      render: (row) => <div className="font-medium text-[var(--foreground)]">{row.title}</div>,
      sortable: true,
    },
    {
      key: "isActive",
      label: "Holat",
      render: (row) => (
        <span className={`px-2 py-1 rounded-full text-xs font-semibold ${row.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
          {row.isActive ? 'Faol' : 'Nofaol'}
        </span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end gap-2">
          <Button size="sm" variant="secondary" onClick={() => handleEdit(row)} title="Tahrirlash">
            <Edit2 size={16} />
          </Button>
          <Button size="sm" variant="secondary" className="text-red-500 hover:text-red-600 hover:bg-red-50" onClick={() => handleDelete(row.id)} title="O'chirish">
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
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Bannerlar</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Safaar platformasining asosiy sahifasidagi orqa fon va slayder rasmlarini boshqarish
          </p>
        </div>
        <Button onClick={handleAddNew} icon={<Plus size={16} />}>
          Yangi banner qo'shish
        </Button>
      </div>

      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
          </div>
        ) : (
          <DataTable
            data={items}
            columns={columns}
            keyField="id"
            emptyMessage="Bannerlar topilmadi"
          />
        )}
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Bannerni tahrirlash" : "Yangi banner"}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4 pt-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Sarlavha</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Qishki takliflar"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)]"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Rasm yuklash</label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setImageUrl(URL.createObjectURL(file));
                }
              }}
              className="w-full text-sm text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)]/10 file:text-[var(--primary)] hover:file:bg-[var(--primary)]/20 cursor-pointer"
              required={!imageUrl}
            />
            {imageUrl && (
              <div className="mt-2 relative w-full h-32 rounded border border-[var(--border)] overflow-hidden">
                <img src={imageUrl} alt="Preview" className="object-cover w-full h-full" />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-[var(--primary)] focus:ring-[var(--primary)]"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-[var(--foreground)] cursor-pointer">
              Faol holatda (saytda ko'rsatiladi)
            </label>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-[var(--border)] mt-4">
            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)}>
              Bekor qilish
            </Button>
            <Button type="submit" disabled={saving} icon={<Save size={16} />}>
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
