import Link from "next/link";
import { defaultLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { Button } from "@/components/ui/Button";
import { MapPinOff } from "lucide-react";

export default async function NotFound() {
  const dict = await getDictionary(defaultLocale, "errors");
  const { notFound } = dict;

  return (
    <main className="mx-auto flex w-full flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <div className="flex w-full max-w-xl flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-slate-50 border border-slate-100">
          <MapPinOff className="h-12 w-12 text-slate-400" />
        </div>
        
        <p className="mb-2 text-6xl font-black tracking-tighter text-blue-600 sm:text-7xl">
          {notFound.code}
        </p>
        
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          {notFound.title}
        </h1>
        
        <p className="mb-8 text-base font-medium leading-relaxed text-slate-600">
          {notFound.text}
        </p>
        
        <Link href={`/${defaultLocale}`} className="w-full sm:w-auto">
          <Button size="lg" variant="primary" className="w-full font-bold sm:w-auto shadow-md">
            {notFound.home}
          </Button>
        </Link>
      </div>
    </main>
  );
}
