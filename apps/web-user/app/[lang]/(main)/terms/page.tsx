import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n/config";
import fs from "fs";
import path from "path";

import { Download } from "lucide-react";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  
  const titles: Record<Locale, string> = {
    uz: "Ommaviy Oferta",
    ru: "Публичная Оферта",
    en: "Public Offer"
  };
  
  return { title: titles[lang as Locale] || "Ommaviy Oferta" };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();

  let htmlContent = "";
  try {
    const filePath = path.join(process.cwd(), `data/terms/${lang}.html`);
    htmlContent = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    const fallbackPath = path.join(process.cwd(), `data/terms/uz.html`);
    htmlContent = fs.readFileSync(fallbackPath, "utf8");
  }

  const downloadTexts: Record<Locale, string> = {
    uz: "Hujjatni yuklab olish",
    ru: "Скачать документ",
    en: "Download document"
  };

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-8 sm:py-12">
      {/* Top action bar */}
      <div className="flex justify-end mb-6">
        <a
          href="/docs/safaar-oferta-uz.docx"
          download
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:text-slate-900 px-4 py-2.5 rounded-xl shadow-sm transition-all dark:bg-slate-900 dark:text-slate-300 dark:border-slate-800 dark:hover:bg-slate-800 dark:hover:text-white active:scale-95"
        >
          <Download className="w-4 h-4" />
          {downloadTexts[lang as Locale]}
        </a>
      </div>

      <div className="bg-white rounded-xl sm:rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-12 lg:p-16 dark:bg-slate-900 dark:border-slate-800">
        {/* Content generated from DOCX with manual resets */}
        <div 
          className="
            text-slate-700 dark:text-slate-300
            [&>p]:mb-4 [&>p]:leading-relaxed
            [&>p:nth-child(-n+7)]:text-center [&>p:nth-child(1)_img]:mx-auto [&>p:nth-child(1)_img]:mb-6 [&>p:nth-child(1)_img]:w-40
            [&>p:nth-child(2)]:text-2xl [&>p:nth-child(5)]:text-2xl [&>p:nth-child(5)]:mt-12
            [&>p:nth-child(7)]:border-b [&>p:nth-child(7)]:border-slate-200 [&>p:nth-child(7)]:pb-8 [&>p:nth-child(7)]:mb-8
            [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mt-8 [&>h1]:mb-4 [&>h1]:text-slate-900 [&>h1]:dark:text-white
            [&>h2]:text-xl [&>h2]:font-bold [&>h2]:mt-8 [&>h2]:mb-4 [&>h2]:text-slate-900 [&>h2]:dark:text-white
            [&>h3]:text-lg [&>h3]:font-bold [&>h3]:mt-6 [&>h3]:mb-3 [&>h3]:text-slate-900 [&>h3]:dark:text-white
            [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:mb-4 [&>ul>li]:mb-2
            [&>ol]:list-decimal [&>ol]:pl-6 [&>ol]:mb-4 [&>ol>li]:mb-2
            [&_strong]:font-bold [&_strong]:text-slate-900 [&_strong]:dark:text-white
          "
          dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </main>
  );
}
