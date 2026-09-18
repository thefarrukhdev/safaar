"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Languages, ShieldOff, AlertTriangle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import DataTable, { Column } from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import { AdminApi } from "@/lib/api/admin-api";
import { extractApiErrorMessage } from "@/lib/utils";
import { CMS_RESOURCES, type CmsEntry, type CmsResource } from "@/types/admin";

/**
 * 2026-09-14 SAFAAR admin gap closure — real Translations management,
 * reusing the EXISTING generic /admin/cms/:resource backend (cms_entries
 * title/body Json) — no new backend, no new i18n key/value format.
 */

const RESOURCE_LABELS: Record<CmsResource, string> = {
  banners: "Bannerlar",
  offers: "Takliflar",
  news: "Yangiliklar",
  pages: "Sahifalar",
  templates: "Shablonlar",
  broadcasts: "Xabarnomalar",
  destinations: "Yo'nalishlar",
};

const LANGUAGES: { code: string; label: string }[] = [
  { code: "uz", label: "O'zbekcha" },
  { code: "ru", label: "Ruscha" },
  { code: "en", label: "Inglizcha" },
];

function isForbidden(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    (err as { response?: { status?: number } }).response?.status === 403
  );
}

export default function TranslationsPage() {
  const [resource, setResource] = useState<CmsResource>("pages");
  const [entries, setEntries] = useState<CmsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [editing, setEditing] = useState<CmsEntry | null>(null);
  const [activeLang, setActiveLang] = useState("uz");
  const [titleDraft, setTitleDraft] = useState<Record<string, string>>({});
  const [bodyDraft, setBodyDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const fetchEntries = () => {
    setLoading(true);
    setError(false);
    setForbidden(false);
    AdminApi.getCmsEntries(resource)
      .then((items) => setEntries(items))
      .catch((err) => {
        if (isForbidden(err)) setForbidden(true);
        else setError(true);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const load = () => fetchEntries();
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource]);

  const openEdit = (entry: CmsEntry) => {
    setEditing(entry);
    setTitleDraft({ ...entry.title });
    setBodyDraft({ ...entry.body });
    setActiveLang("uz");
  };

  const missingLanguages = (entry: CmsEntry): string[] =>
    LANGUAGES.filter((l) => !entry.title[l.code]?.trim()).map((l) => l.code);

  const handleSave = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      // Backend title/body ustunlari TO'LIQ almashtiriladi (merge emas) —
      // shu sabab HAR DOIM barcha tillarning joriy holatini birga
      // yuboramiz, faqat o'zgargan tilni emas (aks holda boshqa tillar
      // yo'qolib qolardi).
      await AdminApi.updateCmsEntryTranslations(
        resource,
        editing.id,
        titleDraft,
        bodyDraft,
      );
      toast.success("Tarjimalar saqlandi");
      setEditing(null);
      fetchEntries();
    } catch (err) {
      toast.error(extractApiErrorMessage(err, "Saqlashda xatolik yuz berdi"));
    } finally {
      setSaving(false);
    }
  };

  const columns: Column<CmsEntry>[] = [
    {
      key: "title",
      label: "Nomi (uz)",
      render: (e) => (
        <span className="font-medium text-[var(--text-primary)]">
          {e.title.uz || <span className="text-[var(--text-muted)] italic">Tarjima yo&apos;q</span>}
        </span>
      ),
    },
    {
      key: "missing",
      label: "Yetishmayotgan tillar",
      render: (e) => {
        const missing = missingLanguages(e);
        return missing.length === 0 ? (
          <span className="text-xs text-[var(--success)]">To&apos;liq</span>
        ) : (
          <span className="text-xs text-[var(--warning)] font-medium">
            {missing.join(", ").toUpperCase()}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Holat",
      render: (e) => (
        <span className="text-xs text-[var(--text-secondary)] capitalize">{e.status}</span>
      ),
    },
    {
      key: "actions",
      label: "",
      render: (e) => (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={() => openEdit(e)}>
            Tahrirlash
          </Button>
        </div>
      ),
    },
  ];

  if (forbidden) {
    return (
      <Card padding="lg">
        <div className="flex flex-col items-center text-center gap-3 py-16">
          <ShieldOff size={28} className="text-[var(--danger)]" aria-hidden />
          <p className="text-sm font-medium text-[var(--text-primary)]">
            Bu bo&apos;lim uchun ruxsatingiz yo&apos;q
          </p>
          <p className="text-xs text-[var(--text-muted)] max-w-sm">
            Tarjimalarni ko&apos;rish uchun translations:read ruxsati kerak.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Languages size={22} aria-hidden /> Tarjimalar
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Kontent turini tanlang va uz/ru/en tarjimalarini boshqaring
          </p>
        </div>
        <div className="w-56">
          <Select
            options={CMS_RESOURCES.map((r) => ({ value: r, label: RESOURCE_LABELS[r] }))}
            value={resource}
            onChange={(e) => setResource(e.target.value as CmsResource)}
            aria-label="Kontent turi"
          />
        </div>
      </div>

      <DataTable
        columns={columns}
        data={entries}
        keyField="id"
        emptyMessage="Bu turda kontent topilmadi"
        isLoading={loading}
        isError={error}
        onRetry={fetchEntries}
      />

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Tarjimalarni tahrirlash"
        size="lg"
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditing(null)}>
              Bekor qilish
            </Button>
            <Button size="sm" loading={saving} onClick={() => void handleSave()}>
              Saqlash
            </Button>
          </>
        }
      >
        {editing && (
          <div className="flex flex-col gap-4">
            <div
              role="tablist"
              aria-label="Til tanlash"
              className="flex gap-1 border-b border-[var(--border)]"
            >
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  role="tab"
                  aria-selected={activeLang === lang.code}
                  onClick={() => setActiveLang(lang.code)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary)] cursor-pointer ${
                    activeLang === lang.code
                      ? "border-[var(--primary)] text-[var(--primary)]"
                      : "border-transparent text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {lang.label}
                  {!titleDraft[lang.code]?.trim() && (
                    <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[var(--warning)]" aria-label="Tarjima yo'q" />
                  )}
                </button>
              ))}
            </div>

            {!titleDraft[activeLang]?.trim() && (
              <div className="flex items-center gap-2 text-xs text-[var(--warning)] bg-[var(--warning)]/10 px-3 py-2 rounded-lg">
                <AlertTriangle size={14} aria-hidden />
                Bu til uchun tarjima hali kiritilmagan
              </div>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor="translation-title" className="text-sm font-medium text-[var(--text-secondary)]">
                Sarlavha
              </label>
              <input
                id="translation-title"
                type="text"
                value={titleDraft[activeLang] ?? ""}
                onChange={(e) =>
                  setTitleDraft((prev) => ({ ...prev, [activeLang]: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="translation-body" className="text-sm font-medium text-[var(--text-secondary)]">
                Matn
              </label>
              <textarea
                id="translation-body"
                rows={6}
                value={bodyDraft[activeLang] ?? ""}
                onChange={(e) =>
                  setBodyDraft((prev) => ({ ...prev, [activeLang]: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] resize-y"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
