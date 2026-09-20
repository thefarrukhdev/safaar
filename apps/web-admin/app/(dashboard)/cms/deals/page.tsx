"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminApi } from "@/lib/api/admin-api";
import type { CmsArticle } from "@/types/admin";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { Plus, Edit2, Trash2, Save, Image as ImageIcon } from "lucide-react";

export default function DealsPage() {
  const [items, setItems] = useState<CmsArticle[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CmsArticle | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [cityName, setCityName] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [oldPrice, setOldPrice] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [discountPercent, setDiscountPercent] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);

  const fetchDeals = async () => {
    try {
      const data = await AdminApi.getCmsOffers();
      setItems(data);
    } catch (error) {
      toast.error("Chegirmalarni yuklashda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDeals();
  }, []);

  const handleEdit = (item: CmsArticle) => {
    setEditingItem(item);
    setTitle(item.title || "");
    setSlug(item.slug || "");
    setCityName(item.metadata?.cityName?.uz || item.metadata?.cityName || "");
    // Legacy records from the pre-fix bug stored dead blob: URLs — treat those as "no image"
    const storedImageUrl = item.metadata?.imageUrl || "";
    setImageUrl(storedImageUrl.startsWith("blob:") ? "" : storedImageUrl);
    setOldPrice(item.metadata?.oldPrice || "");
    setNewPrice(item.metadata?.newPrice || "");
    setDiscountPercent(item.metadata?.discountPercent || "");
    setEndsAt(item.metadata?.endsAt || "");
    setIsActive(item.status === "published");
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setTitle("");
    setSlug("");
    setCityName("");
    setImageUrl("");
    setOldPrice("");
    setNewPrice("");
    setDiscountPercent("");
    setEndsAt("");
    setIsActive(true);
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Haqiqatan ham bu chegirmali taklifni o'chirmoqchimisiz?")) return;
    try {
      await AdminApi.deleteCmsOffer(id);
      toast.success("Taklif o'chirildi");
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
    if (uploading) {
      toast.error("Rasm yuklanishini kuting");
      return;
    }
    setSaving(true);
    try {
      const payload: Partial<CmsArticle> = {
        title,
        slug: slug || `deal-${Date.now()}`,
        status: isActive ? "published" : "draft",
        metadata: {
          cityName: { uz: cityName, ru: cityName, en: cityName },
          imageUrl,
          oldPrice: oldPrice ? Number(oldPrice) : null,
          newPrice: newPrice ? Number(newPrice) : null,
          discountPercent: discountPercent ? Number(discountPercent) : null,
          endsAt: endsAt || null,
        }
      };

      if (editingItem) {
        const updated = await AdminApi.updateCmsOffer(editingItem.id, payload);
        if (isActive !== (editingItem.status === 'published')) {
          await AdminApi.setCmsOfferStatus(editingItem.id, isActive ? 'published' : 'draft');
          updated.status = isActive ? 'published' : 'draft';
        }
        setItems(items.map((t) => (t.id === updated.id ? updated : t)));
        toast.success("Taklif yangilandi");
      } else {
        let created = await AdminApi.createCmsOffer(payload as any);
        if (isActive) {
           await AdminApi.setCmsOfferStatus(created.id, 'published');
           created.status = 'published';
        }
        setItems([created, ...items]);
        toast.success("Yangi taklif qo'shildi");
      }
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<CmsArticle>[] = [
    {
      key: "imageUrl",
      label: "Rasm",
      render: (row) => (
        <div className="relative w-16 h-12 rounded overflow-hidden bg-gray-100 border border-[var(--border)]">
          {row.metadata?.imageUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={row.metadata.imageUrl} alt={row.title} className="object-cover w-full h-full" />
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
      key: "cityName",
      label: "Shahar",
      render: (row) => <div>{row.metadata?.cityName?.uz || row.metadata?.cityName || "-"}</div>,
    },
    {
      key: "price",
      label: "Narxi",
      render: (row) => (
        <div>
           {row.metadata?.newPrice && <span className="font-medium text-[var(--foreground)]">{row.metadata.newPrice} UZS</span>}
           {row.metadata?.oldPrice && <span className="text-xs text-[var(--text-muted)] line-through ml-2">{row.metadata.oldPrice}</span>}
        </div>
      )
    },
    {
      key: "status",
      label: "Holat",
      render: (row) => {
        const isActive = row.status === 'published';
        return (
          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
            {isActive ? 'Faol' : 'Nofaol'}
          </span>
        )
      },
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
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Chegirmali Takliflar</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Bosh sahifadagi chegirmali sayohatlar va takliflarni boshqarish (Deals)
          </p>
        </div>
        <Button onClick={handleAddNew} icon={<Plus size={16} />}>
          Yangi qo'shish
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
            emptyMessage="Chegirmali takliflar topilmadi"
          />
        )}
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Taklifni tahrirlash" : "Yangi taklif"}
        size="lg"
      >
        <form onSubmit={handleSave} className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Sarlavha (Nomi)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Hashamatli dam olish"
              required
            />
            
            <Input
              label="Shahar nomi"
              value={cityName}
              onChange={(e) => setCityName(e.target.value)}
              placeholder="Masalan: Toshkent"
            />

            <Input
              label="Eski narxi (UZS)"
              type="number"
              value={oldPrice}
              onChange={(e) => setOldPrice(e.target.value)}
              placeholder="Masalan: 500000"
            />

            <Input
              label="Yangi narxi (UZS)"
              type="number"
              value={newPrice}
              onChange={(e) => setNewPrice(e.target.value)}
              placeholder="Masalan: 350000"
            />
            
            <Input
              label="Chegirma foizi (%)"
              type="number"
              value={discountPercent}
              onChange={(e) => setDiscountPercent(e.target.value)}
              placeholder="Masalan: 30"
            />

            <Input
              label="Amal qilish muddati (Tugash sanasi)"
              type="datetime-local"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
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
              required={!imageUrl}
            />
            {uploading && (
              <p className="text-xs text-[var(--muted-foreground)]">Yuklanmoqda...</p>
            )}
            {imageUrl && !uploading && (
              <div className="mt-2 relative w-full h-40 rounded border border-[var(--border)] overflow-hidden">
                {/* eslint-disable-next-line @next/next/no-img-element */}
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
