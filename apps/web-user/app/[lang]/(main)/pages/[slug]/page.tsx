import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { api, ApiRequestError } from "@/lib/api";
import { buildCmsMetadata } from "@/lib/seo/cms-metadata";

const UPDATED_LABEL: Record<Locale, string> = {
  uz: "Yangilangan",
  ru: "Обновлено",
  en: "Updated",
};

const getCachedCmsPage = cache(async (locale: Locale, slug: string) => {
  try {
    return await api.cms.getPage(locale, slug);
  } catch (error: unknown) {
    if (error instanceof ApiRequestError && error.statusCode === 404) {
      return 404 as const;
    }
    throw error;
  }
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}): Promise<Metadata> {
  const { lang, slug } = await params;
  const locale: Locale = isLocale(lang) ? lang : "uz";
  const entry = await getCachedCmsPage(locale, slug);
  if (!entry || entry === 404) return {};

  return buildCmsMetadata({
    entry,
    locale,
    path: `/pages/${slug}`,
    fallbackTitle: entry.title,
    fallbackDescription: entry.content?.slice(0, 160),
  });
}

export default async function CmsPagePage({
  params,
}: {
  params: Promise<{ lang: string; slug: string }>;
}) {
  const { lang, slug } = await params;
  const locale: Locale = isLocale(lang) ? lang : "uz";
  const [entry, common] = await Promise.all([
    getCachedCmsPage(locale, slug),
    getDictionary(locale, "common"),
  ]);

  if (!entry || entry === 404) {
    notFound();
  }

  const paragraphs = entry.content
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          {entry.title || common.brand}
        </h1>
        {entry.updatedAt && (
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {UPDATED_LABEL[locale]}:{" "}
            {new Date(entry.updatedAt).toLocaleDateString(locale)}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-4 text-base leading-relaxed text-slate-600 dark:text-slate-400">
        {paragraphs.length > 0 ? (
          paragraphs.map((paragraph, index) => (
            <p key={index} className="whitespace-pre-wrap">
              {paragraph}
            </p>
          ))
        ) : (
          <p className="whitespace-pre-wrap">{entry.content}</p>
        )}
      </div>
    </main>
  );
}
