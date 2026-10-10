import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Card, CardBody } from "@/components/ui/Card";
import { api } from "@/lib/api";
import { Hero } from "@/components/features/home/Hero";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale, "static");
  return { title: dict.about.title };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  const dict = await getDictionary(locale, "static");
  const { about } = dict;

  const heroMap = await api.heroBackgrounds.getHeroMap();
  const heroData = heroMap['about'];

  const heroTitle = heroData ? (typeof heroData.title === "object" ? heroData.title?.[locale] : heroData.titleText) : undefined;
  const heroSubtitle = heroData ? (typeof heroData.subtitle === "object" ? heroData.subtitle?.[locale] : heroData.subtitleText) : undefined;

  return (
    <div className="flex flex-col flex-1 w-full">
      {heroData ? (
        <Hero dict={{ title: heroTitle || about.title, subtitle: heroSubtitle || about.intro } as any} heroBg={{...heroData, title: heroTitle, subtitle: heroSubtitle}} />
      ) : (
        <div className="mx-auto flex w-full max-w-5xl flex-col px-6 pt-12">
          <section className="flex flex-col gap-3">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl ">
              {about.title}
            </h1>
            <p className="max-w-3xl text-lg text-slate-600 ">
              {about.intro}
            </p>
          </section>
        </div>
      )}

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-12 px-6 py-12">

      {/* Maqsad */}
      <section className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold text-slate-900 ">{about.missionTitle}</h2>
        <p className="max-w-3xl text-slate-600 ">
          {about.mission}
        </p>
      </section>

      {/* Qadriyatlar */}
      <section className="flex flex-col gap-4">
        <h2 className="text-2xl font-semibold text-slate-900 ">{about.valuesTitle}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {about.values.map((value, index) => (
            <Card key={index}>
              <CardBody className="flex flex-col gap-2">
                <h3 className="text-lg font-semibold text-slate-900 ">{value.title}</h3>
                <p className="text-sm text-slate-600 ">
                  {value.text}
                </p>
              </CardBody>
            </Card>
          ))}
        </div>
      </section>
    </main>
    </div>
  );
}
