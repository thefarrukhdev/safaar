import { rawApi } from "../client";
import { camelizeKeys } from "../case";
import type { CmsPageView, Locale } from "../types";

export interface PublicStatsView {
  totalHotels: number;
  totalCities: number;
  averageRating: number;
  totalBookings: number;
  totalPartners: number;
}

type Localized = Partial<Record<Locale, string | null>> &
  Record<string, string | null | undefined>;
type LocalizedValue = Localized | string | null | undefined;

function pickLocale(value: LocalizedValue, locale: Locale): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return (
    value[locale] ??
    value.uz ??
    Object.values(value).find((entry) => Boolean(entry)) ??
    ""
  );
}

export interface BannerView {
  id: string;
  title: string;
  imageUrl: string;
  link: string | null;
}

interface RawBanner {
  id: string;
  title?: LocalizedValue;
  imageUrl?: string;
  link?: string;
  order?: number;
}

export interface DealView {
  id: string;
  slug: string;
  name: string;
  cityName: string;
  imageUrl: string;
  oldPriceSum: number;
  newPriceSum: number;
  discountPercent: number;
  endsAt: string;
  status: string;
}

interface RawDeal {
  id: string;
  slug: string;
  name: LocalizedValue;
  cityName?: LocalizedValue;
  imageUrl?: string;
  oldPrice?: number;
  newPrice?: number;
  discountPercent?: number;
  endsAt?: string;
  status?: string;
}

interface RawCmsPage {
  id?: string;
  slug?: string;
  title?: LocalizedValue;
  titleText?: string;
  body?: LocalizedValue;
  bodyText?: string;
  content?: string;
  status?: string;
  metadata?: {
    seoTitle?: string;
    seoDescription?: string;
    excerpt?: string;
  };
  seoTitle?: string;
  seoDescription?: string;
  publishedAt?: string;
  updatedAt?: string;
}

/** Destinations (`catalog.service.ts`) bilan bir xil qoida — faqat relative
 * (`/`-prefiksli) havolalar ruxsat etiladi, tashqi/absolyut URL yoki
 * `javascript:` kabi sxemalar XSS/open-redirect xavfi tug'dirishi mumkin. */
function safeInternalLink(value: string | undefined): string | null {
  const link = (value ?? '').trim();
  return link.startsWith('/') ? link : null;
}

function toBannerView(raw: RawBanner, locale: Locale): BannerView {
  return {
    id: raw.id,
    title: pickLocale(raw.title, locale),
    imageUrl: raw.imageUrl ?? '',
    link: safeInternalLink(raw.link),
  };
}

function toDealView(raw: RawDeal, locale: Locale): DealView {
  return {
    id: raw.id,
    slug: raw.slug,
    name: pickLocale(raw.name, locale),
    cityName: pickLocale(raw.cityName, locale),
    imageUrl: raw.imageUrl ?? "",
    oldPriceSum: Number(raw.oldPrice ?? 0),
    newPriceSum: Number(raw.newPrice ?? 0),
    discountPercent: raw.discountPercent ?? 0,
    endsAt: raw.endsAt ?? "",
    status: raw.status ?? "active",
  };
}

function toCmsPageView(raw: RawCmsPage, locale: Locale): CmsPageView {
  const title = raw.titleText || pickLocale(raw.title, locale);
  const content =
    raw.content || raw.bodyText || pickLocale(raw.body, locale) || "";
  const seoTitle = raw.seoTitle || raw.metadata?.seoTitle || title;

  return {
    id: raw.id ?? "",
    slug: raw.slug ?? "",
    title,
    content,
    status: raw.status ?? "published",
    publishedAt: raw.publishedAt ?? "",
    updatedAt: raw.updatedAt ?? "",
    seoTitle,
    seoDescription:
      raw.seoDescription || raw.metadata?.seoDescription || raw.metadata?.excerpt || "",
  };
}

export interface BannerView {
  id: string;
  title: string;
  imageUrl: string;
  link: string;
  buttonText: string;
}

export const cmsService = {
  /** `GET /cms/banners` — bosh sahifadagi banner/slayder uchun. */
  async getBanners(locale: Locale): Promise<BannerView[]> {
    const raw = await rawApi.get<unknown>('/cms/banners', {
      next: { revalidate: 60 },
    } as any);
    const items = camelizeKeys<RawBanner[]>(raw);
    return (items ?? [])
      .filter((item) => {
        const status = item.status ?? "active";
        return status === "active" || status === "published";
      })
      .map((item) => toBannerView(item, locale));
  },

  /** `GET /cms/offers` — bosh sahifa "Chegirmadagi takliflar" uchun. */
  async getDeals(locale: Locale): Promise<DealView[]> {
    const raw = await rawApi.get<unknown>("/cms/offers", {
      next: { revalidate: 300 },
    } as any);
    const items = camelizeKeys<RawDeal[]>(raw);
    return (items ?? [])
      .filter((item) => {
        const status = item.status ?? "active";
        return status === "active" || status === "published";
      })
      .map((item) => toDealView(item, locale));
  },

  /** `GET /cms/pages/:slug` — user paneldagi statik sahifalar uchun. */
  async getPage(locale: Locale, slug: string): Promise<CmsPageView> {
    const raw = await rawApi.get<unknown>(
      `/cms/pages/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
    return toCmsPageView(camelizeKeys<RawCmsPage>(raw), locale);
  },

  /** `GET /stats/public` — bosh sahifa "TrustBar" statistikasi uchun. */
  async getPublicStats(): Promise<PublicStatsView | null> {
    const raw = await rawApi.get<unknown>("/stats/public", {
      next: { revalidate: 3600 },
    } as any);
    if (!raw) return null;
    const data = camelizeKeys<PublicStatsView>(raw);
    return {
      totalHotels: data.totalHotels ?? 0,
      totalCities: data.totalCities ?? 0,
      averageRating: Number(data.averageRating) || 0,
      totalBookings: data.totalBookings ?? 0,
      totalPartners: data.totalPartners ?? 0,
    };
  },
};
