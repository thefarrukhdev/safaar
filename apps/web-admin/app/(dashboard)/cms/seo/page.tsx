"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Search, ShieldOff, AlertTriangle } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import DataTable, { Column } from "@/components/ui/DataTable";
import Modal from "@/components/ui/Modal";
import { AdminApi } from "@/lib/api/admin-api";
import { extractApiErrorMessage } from "@/lib/utils";
import { CMS_RESOURCES, type CmsEntry, type CmsEntrySeo, type CmsResource } from "@/types/admin";

/**
 * 2026-09-14 SAFAAR admin gap closure — real SEO field management.
 *
 * AUDIT RESULT (honest, not guessed): there is no dedicated SEO model in
 * the backend. cms_entries has a free-form `metadata` Json column already
 * used for arbitrary key/value data — SEO fields are persisted there as
 * `metadata.seo.*` via the EXISTING generic PATCH /admin/cms/:resource/:id
 * (shallow JSONB merge, confirmed in admin.service.ts::cmsUpdate). No new
 * migration was needed.
 *
 * 2026-09-14 UPDATE (public SEO closure): `apps/web-user` now reads this
 * data for the "pages" resource — `GET /cms/pages/:slug` already returned
 * the full `metadata` column, and
 * apps/web-user/app/[lang]/(main)/pages/[slug]/page.tsx::generateMetadata()
 * (via lib/seo/cms-metadata.ts) maps metaTitle/metaDescription/canonical/
 * robots/ogTitle/ogDescription/ogImage into the real <head>, with locale
 * fallback (i18n/config pickLocale) and defense-in-depth sanitization at
 * packages/api-client/src/services/cms.ts (unsafe markup and non-http(s)
 * URLs are dropped even if a direct API call bypasses this form's
 * client-side validate()). Verified live against the QA backend — see
 * e2e/tests/qa-user/seo-metadata.spec.ts.
 *
 * REMAINING LIMITATION (honest, not fixed here): banners/offers/news/
 * templates/broadcasts have no public detail route in web-user yet, so
 * SEO saved for those resources does not affect any live <head> — only
 * "pages" is wired. Also, these fields are locale-agnostic (one shared
 * override across uz/ru/en) since the underlying schema has no per-locale
 * SEO storage; only the page's own content/title is genuinely per-locale.
 */

const RESOURCE_LABELS: Record<CmsResource, string> = {
  banners: "Bannerlar",
  offers: "Takliflar",
  news: "Yangiliklar",
  pages: "Sahifalar",
  templates: "Shablonlar",
  broadcasts: "Xabarnomalar",
};

const META_TITLE_MAX = 60;
const META_DESCRIPTION_MAX = 160;

function isForbidden(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "response" in err &&
    (err as { response?: { status?: number } }).response?.status === 403
  );
}

/** Oddiy, konservativ tekshiruv — <script>/on*= kabi xavfli belgilarni rad etadi. */
function containsUnsafeMarkup(value: string): boolean {
  return /<script|<\/script|on\w+\s*=|javascript:/i.test(value);
}

function isSafeUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value, "https://safaar.uz");
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export default function SeoPage() {
  const [resource, setResource] = useState<CmsResource>("pages");
  const [entries, setEntries] = useState<CmsEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [forbidden, setForbidden] = useState(false);

  const [editing, setEditing] = useState<CmsEntry | null>(null);
  const [draft, setDraft] = useState<CmsEntrySeo>({});
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
    setDraft({ ...entry.seo });
  };

  const validate = (): string | null => {
    if ((draft.metaTitle?.length ?? 0) > META_TITLE_MAX) {
      return `Meta sarlavha ${META_TITLE_MAX} belgidan oshmasligi kerak`;
    }
    if ((draft.metaDescription?.length ?? 0) > META_DESCRIPTION_MAX) {
      return `Meta tavsif ${META_DESCRIPTION_MAX} belgidan oshmasligi kerak`;
    }
    for (const [field, value] of Object.entries(draft)) {
      if (typeof value === "string" && containsUnsafeMarkup(value)) {
        return `${field} maydonida ruxsat etilmagan belgilar bor`;
      }
    }
    if (draft.canonical && !isSafeUrl(draft.canonical)) {
      return "Canonical URL noto'g'ri formatda";
    }
    if (draft.ogImage && !isSafeUrl(draft.ogImage)) {
      return "OG rasm manzili noto'g'ri formatda";
    }
    return null;
  };

  const handleSave = async () => {
    if (!editing) return;
    const validationError = validate();
    if (validationError) {
      toast.error(validationError);
      return;
    }
    setSaving(true);
    try {
      await AdminApi.updateCmsEntrySeo(resource, editing.id, draft);
      toast.success("SEO ma'lumotlari saqlandi");
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
      label: "Sahifa",
      render: (e) => (
        <span className="font-medium text-[var(--text-primary)]">
          {e.title.uz || e.slug || e.id}
        </span>
      ),
    },
    {
      key: "metaTitle",
      label: "Meta sarlavha",
      render: (e) =>
        e.seo.metaTitle ? (
          <span className="text-[var(--text-secondary)]">{e.seo.metaTitle}</span>
        ) : (
          <span className="text-xs text-[var(--warning)]">Kiritilmagan</span>
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
            SEO sozlamalarini ko&apos;rish uchun seo:read ruxsati kerak.
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
            <Search size={22} aria-hidden /> SEO
          </h1>
          <p className="text-[var(--text-secondary)] text-sm mt-1">
            Meta ma&apos;lumotlarni boshqarish — &quot;Sahifalar&quot; turi
            uchun public saytda (/[til]/pages/:slug) avtomatik ishlatiladi
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

      <div className="flex items-start gap-3 rounded-xl border border-[var(--warning)]/30 bg-[var(--warning)]/10 p-4">
        <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[var(--warning)]" aria-hidden />
        <p className="text-xs text-[var(--text-secondary)]">
          {resource === "pages" ? (
            <>
              Bu maydonlar public saytda haqiqatda ishlatiladi:
              web-user&apos;ning{" "}
              <code className="font-mono">/[til]/pages/:slug</code>{" "}
              generateMetadata() shu yerdagi metaTitle/metaDescription/
              canonical/robots/OG qiymatlarini o&apos;qiydi (2026-09-14
              ulangan). Saqlashdan oldin xavfsizlik tekshiruvidan o&apos;tadi.
            </>
          ) : (
            <>
              Ma&apos;lumot xavfsiz saqlanadi, lekin &quot;{RESOURCE_LABELS[resource]}
              &quot; turi uchun public saytda hali alohida sahifa yo&apos;q —
              shuning uchun bu SEO maydonlari hozircha public{" "}
              <code className="font-mono">&lt;head&gt;</code>&apos;ga
              ta&apos;sir qilmaydi. Faqat &quot;Sahifalar&quot; turi hozircha
              ulangan.
            </>
          )}
        </p>
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
        title="SEO ma'lumotlarini tahrirlash"
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
            <div className="flex flex-col gap-1.5">
              <label htmlFor="seo-meta-title" className="text-sm font-medium text-[var(--text-secondary)] flex justify-between">
                <span>Meta sarlavha</span>
                <span className={(draft.metaTitle?.length ?? 0) > META_TITLE_MAX ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}>
                  {draft.metaTitle?.length ?? 0}/{META_TITLE_MAX}
                </span>
              </label>
              <input
                id="seo-meta-title"
                type="text"
                value={draft.metaTitle ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, metaTitle: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="seo-meta-description" className="text-sm font-medium text-[var(--text-secondary)] flex justify-between">
                <span>Meta tavsif</span>
                <span className={(draft.metaDescription?.length ?? 0) > META_DESCRIPTION_MAX ? "text-[var(--danger)]" : "text-[var(--text-muted)]"}>
                  {draft.metaDescription?.length ?? 0}/{META_DESCRIPTION_MAX}
                </span>
              </label>
              <textarea
                id="seo-meta-description"
                rows={3}
                value={draft.metaDescription ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, metaDescription: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="seo-canonical" className="text-sm font-medium text-[var(--text-secondary)]">
                  Canonical URL
                </label>
                <input
                  id="seo-canonical"
                  type="text"
                  value={draft.canonical ?? ""}
                  onChange={(e) => setDraft((prev) => ({ ...prev, canonical: e.target.value }))}
                  placeholder="https://safaar.uz/..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="seo-robots" className="text-sm font-medium text-[var(--text-secondary)]">
                  Robots
                </label>
                <Select
                  options={[
                    { value: "index,follow", label: "index, follow" },
                    { value: "noindex,follow", label: "noindex, follow" },
                    { value: "index,nofollow", label: "index, nofollow" },
                    { value: "noindex,nofollow", label: "noindex, nofollow" },
                  ]}
                  value={draft.robots ?? "index,follow"}
                  onChange={(e) => setDraft((prev) => ({ ...prev, robots: e.target.value }))}
                />
              </div>
            </div>

            <div className="h-px bg-[var(--border)]" />
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide">
              OpenGraph
            </p>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="seo-og-title" className="text-sm font-medium text-[var(--text-secondary)]">
                OG sarlavha
              </label>
              <input
                id="seo-og-title"
                type="text"
                value={draft.ogTitle ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, ogTitle: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="seo-og-description" className="text-sm font-medium text-[var(--text-secondary)]">
                OG tavsif
              </label>
              <textarea
                id="seo-og-description"
                rows={2}
                value={draft.ogDescription ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, ogDescription: e.target.value }))}
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] resize-none"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="seo-og-image" className="text-sm font-medium text-[var(--text-secondary)]">
                OG rasm URL
              </label>
              <input
                id="seo-og-image"
                type="text"
                value={draft.ogImage ?? ""}
                onChange={(e) => setDraft((prev) => ({ ...prev, ogImage: e.target.value }))}
                placeholder="https://..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)]"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
