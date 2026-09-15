import type { Metadata, Viewport } from "next";
import { Inter, Manrope } from "next/font/google";
import { notFound } from "next/navigation";
import "../globals.css";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import {
  defaultLocale,
  isLocale,
  locales,
  type Locale,
} from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { ServiceWorkerRegister } from "@/components/pwa/ServiceWorkerRegister";
import { PwaInstallBanner } from "@/components/pwa/PwaInstallBanner";
import dynamic from "next/dynamic";
import NextTopLoader from "nextjs-toploader";
import { AnalyticsProvider } from "@/components/analytics/AnalyticsProvider";
import { Toaster } from "sonner";
import { config } from "@/lib/config";
import { ClickSpark } from "@/components/ui/ClickSpark";


const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "latin-ext", "cyrillic"],
  display: "swap",
});

const SITE_URL = config.siteUrl;

const OG_LOCALE: Record<Locale, string> = {
  uz: "uz_UZ",
  ru: "ru_RU",
  en: "en_US",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const locale: Locale = isLocale(lang) ? lang : defaultLocale;
  const common = await getDictionary(locale, "common");

  const title = `${common.brand} — ${common.footer.tagline}`;
  const description = common.footer.tagline;

  return {
    metadataBase: new URL(SITE_URL),
    title: { default: title, template: `%s — ${common.brand}` },
    description,
    applicationName: "Safaar",
    manifest: "/manifest.webmanifest",
    appleWebApp: { capable: true, title: "Safaar", statusBarStyle: "default" },
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])) as Record<string, string>,
    },
    openGraph: {
      type: "website",
      siteName: "Safaar",
      locale: OG_LOCALE[locale],
      title,
      description,
      url: `/${locale}`,
    },
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { themeColor: "#059669" };

export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  return (
    <html
      lang={lang}
      data-scroll-behavior="smooth"
      className={`${inter.variable} ${manrope.variable} h-full overflow-x-hidden subpixel-antialiased`}
    >
      <body className="flex min-h-full flex-col overflow-x-hidden bg-slate-100/60 text-slate-900 subpixel-antialiased dark:bg-slate-950 dark:text-slate-100">
        <NextTopLoader color="#2563eb" showSpinner={false} shadow="0 0 10px #2563eb,0 0 5px #2563eb" />
        <AnalyticsProvider>
          <NuqsAdapter>
            <ClickSpark global />
            <div className="relative flex min-h-screen w-full flex-col overflow-x-hidden">
              {children}
              <Toaster position="top-right" richColors />
              <ServiceWorkerRegister />
              <PwaInstallBanner />
            </div>
          </NuqsAdapter>
        </AnalyticsProvider>
      </body>
    </html>
  );
}
