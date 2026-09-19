import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Card, CardBody } from "@/components/ui/Card";

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

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 py-12">
      {/* Sarlavha */}
      <section className="flex flex-col gap-2">
        <h1 className="text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl dark:text-white">
          {help.title}
        </h1>
        <p className="text-lg text-slate-600 dark:text-slate-400">
          {help.subtitle}
        </p>
      </section>

      {/* FAQ — semantik details/summary akkordeon */}
      <section className="flex flex-col gap-3">
        {help.faqs.map((faq, index) => (
          <details
            key={index}
            className="group rounded-xl border border-slate-200 bg-slate-50 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <summary className="flex cursor-pointer items-center justify-between gap-4 p-5 font-semibold text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:text-white">
              <span>{faq.q}</span>
              <span
                aria-hidden="true"
                className="text-primary-600 transition-transform group-open:rotate-45 dark:text-primary-400"
              >
                +
              </span>
            </summary>
            <p className="px-5 pb-5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              {faq.a}
            </p>
          </details>
        ))}
      </section>

      {/* Aloqa */}
      <Card>
        <CardBody className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{help.contactTitle}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {help.contactText}
          </p>
          <a
            href="mailto:support@safaar.uz"
            className="text-sm font-semibold text-primary-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-600 dark:text-primary-400"
          >
            support@safaar.uz
          </a>
        </CardBody>
      </Card>
    </main>
  );
}
