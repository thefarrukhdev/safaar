"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminApi } from "@/lib/api/admin-api";
import type { CmsBanner } from "@/types/admin";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Plus, Edit2, Trash2, Save, Image as ImageIcon } from "lucide-react";

export default function BannersPage() {
  const [items, setItems] = useState<CmsBanner[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CmsBanner | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [link, setLink] = useState("/");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const fetchBanners = async () => {
    try {
      const data = await AdminApi.getCmsBanners();
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

  const handleEdit = (item: CmsBanner) => {
    setEditingItem(item);
    setTitle(item.title);
    setLink(item.link || "/");
    setImageUrl(item.imageUrl);
    setIsActive(item.isActive);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setTitle("");
    setLink("/");
    setImageUrl("");
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Haqiqatan ham bu bannerni o'chirmoqchimisiz?")) return;
    try {
      await AdminApi.deleteCmsBanner(id);
      toast.success("Banner o'chirildi");
      setItems(items.filter((t) => t.id !== id));
    } catch (error) {
      toast.error("O'chirishda xatolik yuz berdi");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await AdminApi.uploadImage(file);
      setImageUrl(uploaded.url);
    } catch (error) {
      toast.error("Rasm yuklashda xatolik yuz berdi");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageUrl) {
      toast.error("Rasm yuklanishini kuting yoki Iltimos rasm yuklang");
      return;
    }
    setSaving(true);
    try {
      const payload = { title, imageUrl, link, isActive, order: editingItem?.order ?? items.length };
      if (editingItem) {
        const updated = await AdminApi.updateCmsBanner(editingItem.id, payload);
        setItems(items.map((t) => (t.id === updated.id ? updated : t)));
        toast.success("Banner yangilandi");
      } else {
        const created = await AdminApi.createCmsBanner(payload);
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

  const columns: Column<CmsBanner>[] = [
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
      key: "link",
      label: "Havola",
      render: (row) => <span className="text-sm text-[var(--muted-foreground)]">{row.link}</span>,
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
            <label className="text-sm font-medium text-[var(--foreground)]">Havola (bosilganda ochiladigan sahifa)</label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              placeholder="/hotels yoki /uz/deals"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Rasm yuklash</label>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="w-full text-sm text-[var(--text-secondary)] file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-[var(--primary)]/10 file:text-[var(--primary)] hover:file:bg-[var(--primary)]/20 cursor-pointer"
            />
            {uploading && (
              <p className="text-xs text-[var(--muted-foreground)]">Yuklanmoqda...</p>
            )}
            {imageUrl && !uploading && (
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
            <Button type="submit" disabled={saving || uploading} icon={<Save size={16} />}>
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
