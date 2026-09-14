"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminApi } from "@/lib/api/admin-api";
import type { AdminSeo } from "@/types/admin";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Edit2, Save } from "lucide-react";

export default function SeoPage() {
  const [items, setItems] = useState<AdminSeo[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminSeo | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [path, setPath] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [keywords, setKeywords] = useState("");

  const fetchSeo = async () => {
    try {
      const data = await AdminApi.getSeoSettings();
      setItems(data);
    } catch (error) {
      toast.error("SEO sozlamalarini yuklashda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSeo();
  }, []);

  const handleEdit = (item: AdminSeo) => {
    setEditingItem(item);
    setPath(item.path);
    setTitle(item.title);
    setDescription(item.description);
    setKeywords(item.keywords);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSaving(true);
    try {
      const payload = { title, description, keywords };
      const updated = await AdminApi.updateSeoSetting(editingItem.id, payload);
      setItems(items.map((t) => (t.id === updated.id ? updated : t)));
      toast.success("SEO sozlamalari yangilandi");
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<AdminSeo>[] = [
    {
      key: "path",
      label: "Sahifa manzili (Path)",
      render: (row) => <span className="text-[var(--primary)] font-medium">{row.path}</span>,
      sortable: true,
    },
    {
      key: "title",
      label: "Meta Title",
      render: (row) => <div className="text-[var(--foreground)] text-sm">{row.title}</div>,
    },
    {
      key: "description",
      label: "Meta Description",
      render: (row) => <div className="text-[var(--muted-foreground)] text-xs max-w-[250px] truncate" title={row.description}>{row.description}</div>,
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={() => handleEdit(row)} title="Tahrirlash">
            <Edit2 size={16} />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 max-w-[1400px] mx-auto animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">SEO va Meta teglar boshqaruvi</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Saytdagi turli sahifalarning qidiruv tizimlaridagi (Google, Yandex) ko'rinishini sozlash (Mock)
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
            data={items}
            columns={columns}
            keyField="id"
            emptyMessage="SEO sozlamalari topilmadi"
          />
        )}
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title="SEO sozlamalarini tahrirlash"
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4 pt-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Sahifa manzili</label>
            <input
              type="text"
              value={path}
              className="w-full px-3 py-2 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md text-[var(--muted-foreground)] cursor-not-allowed"
              disabled
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Meta Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Masalan: Eng yaxshi mehmonxonalar"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)]"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Meta Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Sahifa haqida qisqacha ma'lumot (Google'da ko'rinadi)"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)] resize-none"
              required
            />
            <p className="text-xs text-[var(--muted-foreground)]">Tavsiya etiladigan uzunlik: 150-160 belgi.</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Keywords (Kalit so'zlar)</label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              placeholder="mehmonxona, toshkent, arzon"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)]"
            />
            <p className="text-xs text-[var(--muted-foreground)]">Vergul bilan ajratib yozing.</p>
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
