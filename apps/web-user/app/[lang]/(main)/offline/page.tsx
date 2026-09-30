import { notFound } from "next/navigation";
import { isLocale, locales, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { OfflineRetryControl } from "@/components/features/pwa/OfflineRetryControl";

/** `/uz/offline`, `/ru/offline`, `/en/offline` — oldindan generatsiya. */
export function generateStaticParams() {
  return locales.map((lang) => ({ lang }));
}

/**
 * Offline sahifa — service worker tarmoq yo'q paytda shu sahifani ko'rsatadi.
 * Light/Dark mode va auto-retry ulanish xususiyatlari bilan boyitilgan.
 */
export default async function OfflinePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  const dict = await getDictionary(locale, "errors");
  const { offline, notFound: nf } = dict;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-6 px-6 py-20 text-center">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900  sm:text-3xl">
          {offline.title}
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-slate-600 ">
          {offline.text}
        </p>
      </div>

      <OfflineRetryControl
        locale={locale}
        homeText={nf.home}
        retryText="Qayta ulanishni tekshirish"
      />
    </main>
  );
}
