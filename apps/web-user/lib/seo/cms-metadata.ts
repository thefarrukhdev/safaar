import type { Metadata } from "next";
import type { CmsPageView } from "@safaar/api-client";
import { locales, type Locale } from "@/i18n/config";

/**
 * 2026-09-14 SAFAAR — public SEO closure.
 *
 * Bridges the SEO fields the admin panel already persists at
 * `cms_entries.metadata.seo` (apps/web-admin/app/(dashboard)/cms/seo,
 * `CmsEntrySeo` — metaTitle/metaDescription/canonical/robots/ogTitle/
 * ogDescription/ogImage) into a Next.js `generateMetadata()` result for a
 * CMS-backed public route. Field names are reused as-is — no new schema.
 *
 * Fields are already sanitized upstream (packages/api-client/src/services
 * /cms.ts::toSeoView — unsafe markup stripped, canonical/ogImage restricted
 * to http/https) before they ever reach this function.
 */

const OG_LOCALE: Record<Locale, string> = {
  uz: "uz_UZ",
  ru: "ru_RU",
  en: "en_US",
};

function parseRobots(value: string | undefined): Metadata["robots"] {
  if (!value) return undefined;
  const tokens = value
    .toLowerCase()
    .split(",")
    .map((token) => token.trim());
  return {
    index: !tokens.includes("noindex"),
    follow: !tokens.includes("nofollow"),
  };
}

export function buildCmsMetadata(params: {
  entry: CmsPageView;
  locale: Locale;
  /** Locale-agnostic path, e.g. `/pages/about-us` (no leading locale segment). */
  path: string;
  fallbackTitle: string;
  fallbackDescription?: string;
}): Metadata {
  const { entry, locale, path, fallbackTitle, fallbackDescription } = params;
  const seo = entry.seo;

  const title = seo.metaTitle || entry.seoTitle || fallbackTitle;
  const description =
    seo.metaDescription || entry.seoDescription || fallbackDescription || "";
  const ogTitle = seo.ogTitle || title;
  const ogDescription = seo.ogDescription || description;

  const canonicalPath = `/${locale}${path}`;
  const canonical = seo.canonical || canonicalPath;

  const metadata: Metadata = {
    title,
    description: description || undefined,
    alternates: {
      canonical,
      languages: Object.fromEntries(
        locales.map((l) => [l, `/${l}${path}`]),
      ) as Record<string, string>,
    },
    openGraph: {
      type: "article",
      siteName: "Safaar",
      locale: OG_LOCALE[locale],
      title: ogTitle,
      description: ogDescription || undefined,
      url: canonicalPath,
      ...(seo.ogImage ? { images: [seo.ogImage] } : {}),
    },
  };

  const robots = parseRobots(seo.robots);
  if (robots) {
    metadata.robots = robots;
  }

  return metadata;
}
