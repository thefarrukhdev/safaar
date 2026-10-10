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
 return { title: dict.help.title };
}

export default async function HelpPage({
 params,
}: {
 params: Promise<{ lang: string }>;
}) {
 const { lang } = await params;
 if (!isLocale(lang)) notFound();
 const locale = lang as Locale;

 const dict = await getDictionary(locale, "static");
 const { help } = dict;

  const heroMap = await api.heroBackgrounds.getHeroMap();
  const heroData = heroMap['help'];

  const heroTitle = heroData ? (typeof heroData.title === "object" ? heroData.title?.[locale] : heroData.titleText) : undefined;
  const heroSubtitle = heroData ? (typeof heroData.subtitle === "object" ? heroData.subtitle?.[locale] : heroData.subtitleText) : undefined;

  return (
    <div className="flex flex-col flex-1 w-full">
      {heroData ? (
        <Hero dict={{ title: heroTitle || help.title, subtitle: heroSubtitle || help.subtitle } as any} heroBg={{...heroData, title: heroTitle, subtitle: heroSubtitle}} />
      ) : (
        <div className="mx-auto flex w-full max-w-3xl flex-col px-6 pt-12">
          <section className="flex flex-col gap-2">
            <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl ">
              {help.title}
            </h1>
            <p className="text-lg text-slate-600 ">
              {help.subtitle}
            </p>
          </section>
        </div>
      )}
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">

 {/* FAQ — semantik details/summary akkordeon */}
 <section className="flex flex-col gap-3">
 {help.faqs.map((faq, index) => (
 <details
 key={index}
 className="group rounded-xl border border-slate-200 bg-white border border-slate-200 "
 >
 <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ">
 <span>{faq.q}</span>
 <span
 aria-hidden="true"
 className="text-blue-600 transition-transform group-open:rotate-45 "
 >
 +
 </span>
 </summary>
 <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600 ">
 {faq.a}
 </p>
 </details>
 ))}
 </section>

 {/* Aloqa */}
 <Card>
 <CardBody className="flex flex-col gap-2">
 <h2 className="text-lg font-semibold text-slate-900 ">{help.contactTitle}</h2>
 <p className="text-sm text-slate-600 ">
 {help.contactText}
 </p>
 <a
 href="mailto:support@safaar.uz"
 className="text-sm font-semibold text-blue-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 "
 >
 support@safaar.uz
 </a>
 </CardBody>
 </Card>
 </main>
    </div>
 );
}
