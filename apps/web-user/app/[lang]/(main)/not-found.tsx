import Link from "next/link";
import { defaultLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Button } from "@/components/ui/Button";
import { MapPinOff } from "lucide-react";

export default async function NotFound() {
  const dict = await getDictionary(defaultLocale, "errors");
  const { notFound } = dict;

  return (
    <main className="mx-auto flex w-full flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:px-6">
      <div className="flex w-full max-w-lg flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-white p-8 shadow-xl sm:p-12 dark:border-slate-800 dark:bg-slate-900/50">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
          <MapPinOff className="h-12 w-12 text-slate-400 dark:text-slate-500" />
        </div>
        
        <p className="mb-2 text-6xl font-black tracking-tighter text-primary-600 sm:text-7xl">
          {notFound.code}
        </p>
        
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
          {notFound.title}
        </h1>
        
        <p className="mb-8 text-sm font-medium leading-relaxed text-slate-600 dark:text-slate-400">
          {notFound.text}
        </p>
        
        <Link href="/" className="w-full sm:w-auto">
          <Button size="lg" variant="primary" className="w-full font-bold shadow-md sm:w-auto">
            {notFound.home}
          </Button>
        </Link>
      </div>
    </main>
  );
}
