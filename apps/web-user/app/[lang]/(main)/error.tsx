"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLocale, defaultLocale, type Locale } from "@/i18n/config";
import { Button } from "@/components/ui/Button";
import { ServerCrash } from "lucide-react";
import uzErrors from "@/locales/uz/errors.json";
import ruErrors from "@/locales/ru/errors.json";
import enErrors from "@/locales/en/errors.json";

const errorsByLocale: Record<Locale, typeof uzErrors> = {
  uz: uzErrors,
  ru: ruErrors,
  en: enErrors,
};

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();
  const segment = pathname.split("/").filter(Boolean)[0] ?? "";
  const locale: Locale = isLocale(segment) ? segment : defaultLocale;
  const dict = errorsByLocale[locale].error;

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <div className="flex w-full max-w-lg flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-white p-8 shadow-xl sm:p-12 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-xl bg-red-100 dark:bg-red-900/30">
          <ServerCrash className="h-10 w-10 text-red-600 dark:text-red-500" />
        </div>
        
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          {dict.title}
        </h1>
        
        <p className="mb-8 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
          {dict.text}
        </p>
        
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
          <Button size="lg" variant="primary" onClick={() => reset()} className="w-full font-bold sm:w-auto">
            {dict.retry}
          </Button>
          <Link href="/" className="w-full sm:w-auto">
            <Button size="lg" variant="secondary" className="w-full font-bold sm:w-auto">
              {dict.home}
            </Button>
          </Link>
        </div>
      </div>
    </main>
  );
}
