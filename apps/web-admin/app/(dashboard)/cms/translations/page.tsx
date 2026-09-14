"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminApi } from "@/lib/api/admin-api";
import type { AdminTranslation } from "@/types/admin";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Plus, Edit2, Trash2, Save } from "lucide-react";

export default function TranslationsPage() {
  const [translations, setTranslations] = useState<AdminTranslation[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<AdminTranslation | null>(null);
  const [saving, setSaving] = useState(false);

  // Form states
  const [key, setKey] = useState("");
  const [uz, setUz] = useState("");
  const [ru, setRu] = useState("");
  const [en, setEn] = useState("");

  const fetchTranslations = async () => {
    try {
      const data = await AdminApi.getTranslations();
      setTranslations(data);
    } catch (error) {
      toast.error("Tarjimalarni yuklashda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTranslations();
  }, []);

  const handleEdit = (item: AdminTranslation) => {
    setEditingItem(item);
    setKey(item.key);
    setUz(item.uz);
    setRu(item.ru);
    setEn(item.en);
    setIsModalOpen(true);
  };

  const handleAddNew = () => {
    setEditingItem(null);
    setKey("");
    setUz("");
    setRu("");
    setEn("");
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Haqiqatan ham bu tarjimani o'chirmoqchimisiz?")) return;
    try {
      await AdminApi.deleteTranslation(id);
      toast.success("Tarjima o'chirildi");
      setTranslations(translations.filter((t) => t.id !== id));
    } catch (error) {
      toast.error("O'chirishda xatolik yuz berdi");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { key, uz, ru, en };
      if (editingItem) {
        const updated = await AdminApi.updateTranslation(editingItem.id, payload);
        setTranslations(translations.map((t) => (t.id === updated.id ? updated : t)));
        toast.success("Tarjima yangilandi");
      } else {
        const created = await AdminApi.createTranslation(payload);
        setTranslations([created, ...translations]);
        toast.success("Yangi tarjima qo'shildi");
      }
      setIsModalOpen(false);
    } catch (error) {
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<AdminTranslation>[] = [
    {
      key: "key",
      label: "Kalit so'z (Key)",
      render: (row) => <code className="px-1.5 py-0.5 bg-[var(--bg-tertiary)] rounded text-sm text-[var(--primary)] font-mono">{row.key}</code>,
      sortable: true,
    },
    {
      key: "uz",
      label: "O'zbekcha",
      render: (row) => <div className="text-[var(--foreground)] text-sm max-w-[200px] truncate" title={row.uz}>{row.uz}</div>,
    },
    {
      key: "ru",
      label: "Ruscha",
      render: (row) => <div className="text-[var(--foreground)] text-sm max-w-[200px] truncate" title={row.ru}>{row.ru}</div>,
    },
    {
      key: "en",
      label: "Inglizcha",
      render: (row) => <div className="text-[var(--foreground)] text-sm max-w-[200px] truncate" title={row.en}>{row.en}</div>,
    },
    {
      key: "actions",
      label: "",
      render: (row) => (
        <div className="flex gap-2 justify-end">
          <Button size="sm" variant="secondary" onClick={() => handleEdit(row)} title="Tahrirlash">
            <Edit2 size={16} />
          </Button>
          <Button size="sm" variant="danger" onClick={() => handleDelete(row.id)} title="O'chirish">
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
          <h1 className="text-2xl font-bold text-[var(--foreground)] tracking-tight">Statik Tarjimalar (Dictionary)</h1>
          <p className="text-[var(--muted-foreground)] mt-1">
            Saytdagi tugmalar, menyular va asosiy matnlarni tahrirlash (Mock)
          </p>
        </div>
        <Button onClick={handleAddNew} icon={<Plus size={16} />}>
          Yangi kalit qo'shish
        </Button>
      </div>

      <div className="bg-[var(--card)] rounded-xl border border-[var(--border)] shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--primary)]"></div>
          </div>
        ) : (
          <DataTable
            data={translations}
            columns={columns}
            keyField="id"
            emptyMessage="Tarjimalar topilmadi"
          />
        )}
      </div>

      <Modal
        open={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingItem ? "Tarjimani tahrirlash" : "Yangi tarjima"}
        size="md"
      >
        <form onSubmit={handleSave} className="space-y-4 pt-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Kalit so'z (Key)</label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="Masalan: auth.login.button"
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)] font-mono text-sm"
              required
            />
            <p className="text-xs text-[var(--muted-foreground)]">Dasturchi koddagi joyiga yozadigan qat'iy nom.</p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">O'zbekcha tarjimasi</label>
            <input
              type="text"
              value={uz}
              onChange={(e) => setUz(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)]"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Ruscha tarjimasi</label>
            <input
              type="text"
              value={ru}
              onChange={(e) => setRu(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)]"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-[var(--foreground)]">Inglizcha tarjimasi</label>
            <input
              type="text"
              value={en}
              onChange={(e) => setEn(e.target.value)}
              className="w-full px-3 py-2 bg-[var(--background)] border border-[var(--border)] rounded-md outline-none focus:border-[var(--primary)] text-[var(--foreground)]"
              required
            />
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
