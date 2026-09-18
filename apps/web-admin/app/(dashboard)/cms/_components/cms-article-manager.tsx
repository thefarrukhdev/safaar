"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Edit2, Plus, Send, Trash2 } from "lucide-react";
import type { CmsArticle } from "@/types/admin";
import { AdminApi } from "@/lib/api/admin-api";
import DataTable from "@/components/ui/DataTable";
import type { Column } from "@/components/ui/DataTable";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { formatDate } from "@/lib/utils";

type CmsArticleKind = CmsArticle["type"];

interface CmsArticleManagerProps {
  type: CmsArticleKind;
  title: string;
  addLabel: string;
  emptyMessage: string;
  loadItems: () => Promise<CmsArticle[]>;
}

// Har bir resurs uchun generic CMS (`/admin/cms/:resource`) orqali ishlaydigan
// real create/update/delete/status funksiyalari — offers/destinations bilan
// bir xil naqsh (admin-api.ts).
const API_BY_TYPE: Record<
  CmsArticleKind,
  {
    create: (item: Omit<CmsArticle, "id">) => Promise<CmsArticle>;
    update: (id: string, item: Partial<CmsArticle>) => Promise<CmsArticle>;
    remove: (id: string) => Promise<void>;
    setStatus: (id: string, status: "published" | "draft") => Promise<CmsArticle>;
  }
> = {
  news: {
    create: AdminApi.createCmsNews,
    update: AdminApi.updateCmsNews,
    remove: AdminApi.deleteCmsNews,
    setStatus: AdminApi.setCmsNewsStatus,
  },
  page: {
    create: AdminApi.createCmsPage,
    update: AdminApi.updateCmsPage,
    remove: AdminApi.deleteCmsPage,
    setStatus: AdminApi.setCmsPageStatus,
  },
  offer: {
    create: AdminApi.createCmsOffer,
    update: AdminApi.updateCmsOffer,
    remove: AdminApi.deleteCmsOffer,
    setStatus: AdminApi.setCmsOfferStatus,
  },
};

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/['"`]/g, "")
    .replace(/[^a-z0-9а-яёғқҳўүӣҷ\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CmsArticleManager({
  type,
  title,
  addLabel,
  emptyMessage,
  loadItems,
}: CmsArticleManagerProps) {
  const [items, setItems] = useState<CmsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<Partial<CmsArticle> | null>(null);

  const api = API_BY_TYPE[type];

  const refresh = async () => {
    try {
      const result = await loadItems();
      setItems(result.filter((item) => item.type === type));
    } catch {
      toast.error("Kontentni yuklashda xatolik yuz berdi");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        (b.publishedAt || b.id).localeCompare(a.publishedAt || a.id),
      ),
    [items],
  );

  const openCreate = () => setEditingItem({ type, status: "draft" });
  const openEdit = (item: CmsArticle) => setEditingItem({ ...item });

  const saveItem = async () => {
    if (!editingItem) return;

    const titleValue = editingItem.title?.trim();
    const slugValue = slugify(editingItem.slug || titleValue || "");

    if (!titleValue || !slugValue) {
      toast.error("Sarlavha va slug'ni to'ldiring");
      return;
    }

    setSaving(true);
    try {
      if (editingItem.id) {
        await api.update(editingItem.id, {
          title: titleValue,
          slug: slugValue,
          status: editingItem.status,
        });
        toast.success("Kontent saqlandi");
      } else {
        await api.create({
          title: titleValue,
          slug: slugValue,
          type,
          status: (editingItem.status as CmsArticle["status"]) ?? "draft",
          publishedAt: "",
        });
        toast.success("Yangi kontent yaratildi");
      }
      setEditingItem(null);
      await refresh();
    } catch {
      toast.error("Saqlashda xatolik yuz berdi");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (item: CmsArticle) => {
    const nextStatus = item.status === "published" ? "draft" : "published";
    try {
      await api.setStatus(item.id, nextStatus);
      toast.success(
        nextStatus === "published" ? "Kontent chop etildi" : "Kontent qoralamaga o'tkazildi",
      );
      await refresh();
    } catch {
      toast.error("Holatni o'zgartirishda xatolik yuz berdi");
    }
  };

  const deleteItem = async (item: CmsArticle) => {
    if (!confirm(`"${item.title}" o'chirilsinmi?`)) return;
    try {
      await api.remove(item.id);
      toast.success("Kontent o'chirildi");
      await refresh();
    } catch {
      toast.error("O'chirishda xatolik yuz berdi");
    }
  };

  const columns: Column<CmsArticle>[] = [
    {
      key: "title",
      label: "Sarlavha",
      render: (row) => <span className="font-medium">{row.title}</span>,
    },
    {
      key: "slug",
      label: "Slug (URL)",
      render: (row) => (
        <span className="text-sm text-[var(--text-muted)]">/{row.slug}</span>
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
      key: "publishedAt",
      label: "Sana",
      render: (row) => (
        <span className="text-sm">
          {row.publishedAt ? formatDate(row.publishedAt) : "—"}
        </span>
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
    <>
      <div className="max-w-[1200px] mx-auto flex flex-col gap-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[var(--text-primary)]">
            {title}
          </h2>
          <Button size="sm" icon={<Plus size={14} />} onClick={openCreate}>
            {addLabel}
          </Button>
        </div>

        <DataTable
          columns={columns}
          data={sortedItems}
          keyField="id"
          emptyMessage={emptyMessage}
        />
      </div>

      <Modal
        open={!!editingItem}
        onClose={() => setEditingItem(null)}
        title={editingItem?.id ? "Kontentni tahrirlash" : "Yangi kontent"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditingItem(null)}>
              Bekor qilish
            </Button>
            <Button icon={<Send size={14} />} onClick={saveItem} disabled={saving}>
              {saving ? "Saqlanmoqda..." : "Saqlash"}
            </Button>
          </>
        }
      >
        {editingItem ? (
          <div className="flex flex-col gap-4">
            <Input
              label="Sarlavha"
              value={editingItem.title ?? ""}
              onChange={(event) => {
                const nextTitle = event.target.value;
                setEditingItem({
                  ...editingItem,
                  title: nextTitle,
                  slug: editingItem.slug || slugify(nextTitle),
                });
              }}
            />
            <Input
              label="Slug"
              value={editingItem.slug ?? ""}
              onChange={(event) =>
                setEditingItem({ ...editingItem, slug: slugify(event.target.value) })
              }
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-[var(--text-secondary)]">
                  Holat
                </span>
                <select
                  value={editingItem.status ?? "draft"}
                  onChange={(event) =>
                    setEditingItem({
                      ...editingItem,
                      status: event.target.value as CmsArticle["status"],
                    })
                  }
                  className="w-full rounded-lg border border-[var(--border)] bg-white px-3 py-2 text-sm text-[var(--text-primary)] focus:border-[var(--primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20"
                >
                  <option value="draft">Qoralama</option>
                  <option value="published">Chop etilgan</option>
                </select>
              </label>
              <Input
                label="URL preview"
                value={`/${editingItem.slug || slugify(editingItem.title ?? "")}`}
                readOnly
              />
            </div>
            {editingItem.id && (
              <p className="text-xs text-[var(--text-muted)]">
                Kontent matnini (til bo'yicha) tahrirlash uchun{" "}
                <Link href="/cms/translations" className="font-medium text-[var(--primary)] hover:underline">
                  Tarjimalar
                </Link>{" "}
                bo'limidan foydalaning.
              </p>
            )}
          </div>
        ) : null}
      </Modal>
    </>
  );
}
