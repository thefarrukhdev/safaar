import type { MetadataRoute } from "next";
import { locales, defaultLocale } from "@/i18n/config";
import { config } from "@/lib/config";
import { api } from "@/lib/api";

const SITE_URL = config.siteUrl;

/** Indekslanadigan public yo'llar (har bir til uchun sitemap shakllantiriladi). */
const PUBLIC_PATHS = [
  "",
  "/hotels",
  "/dachas",
  "/sanatoriums",
  "/resorts",
  "/restaurants",
  "/attractions",
  "/about",
  "/help",
  "/terms",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  
  // 1. Static paths
  const staticPaths: MetadataRoute.Sitemap = locales.flatMap((lang) =>
    PUBLIC_PATHS.map((path) => ({
      url: `${SITE_URL}/${lang}${path}`,
      lastModified: now,
      changeFrequency: path === "" ? "daily" : "weekly",
      priority: path === "" ? 1 : 0.8,
      alternates: {
        languages: Object.fromEntries(
          locales.map((l) => [l, `${SITE_URL}/${l}${path}`]),
        ),
      },
    })),
  );

  // 2. Dynamic paths (Hotels)
  let hotelPaths: MetadataRoute.Sitemap = [];
  try {
    const hotelsRes = await api.hotels.getHotels(defaultLocale, { limit: 100 });
    
    if (hotelsRes && hotelsRes.items) {
      hotelPaths = locales.flatMap((lang) =>
        hotelsRes.items.map((hotel) => ({
          url: `${SITE_URL}/${lang}/hotels/${hotel.slug}`,
          lastModified: now,
          changeFrequency: "daily",
          priority: 0.9,
          alternates: {
            languages: Object.fromEntries(
              locales.map((l) => [l, `${SITE_URL}/${l}/hotels/${hotel.slug}`]),
            ),
          },
        })),
      );
    }
  } catch (error) {
    console.error("Failed to fetch hotels for sitemap:", error);
  }

  return [...staticPaths, ...hotelPaths];
}
