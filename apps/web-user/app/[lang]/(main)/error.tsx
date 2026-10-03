"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { isLocale, defaultLocale, type Locale } from "@/i18n/config";
import { Button } from "@/components/ui/Button";
import { ServerCrash, ChevronDown, ChevronUp, Bug } from "lucide-react";
import uzErrors from "@/locales/uz/errors.json";
import ruErrors from "@/locales/ru/errors.json";
import enErrors from "@/locales/en/errors.json";

const errorsByLocale: Record<Locale, typeof uzErrors> = {
  uz: uzErrors,
  ru: ruErrors,
  en: enErrors,
};

function getErrorReasonKey(errorMsg: string = ""): keyof typeof uzErrors.error.reasons {
  const msg = errorMsg.toLowerCase();
  if (msg.includes("fetch failed") || msg.includes("network") || msg.includes("econnrefused")) {
    return "fetch_failed";
  }
  if (msg.includes("401") || msg.includes("unauthorized") || msg.includes("session")) {
    return "auth_error";
  }
  if (msg.includes("timeout") || msg.includes("deadline")) {
    return "timeout";
  }
  return "unknown";
}

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
  
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    console.error("Caught by Error Boundary:", error);
  }, [error]);

  const reasonKey = getErrorReasonKey(error.message);
  const userFriendlyReason = dict.reasons[reasonKey];

  return (
    <main className="mx-auto flex w-full flex-1 flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
      <div className="flex w-full max-w-xl flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm">
        <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-red-50 border border-red-100">
          <ServerCrash className="h-12 w-12 text-red-500" />
        </div>
        
        <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          {dict.title}
        </h1>
        
        <p className="mb-6 text-base font-medium leading-relaxed text-slate-600">
          {dict.text}
        </p>

        <div className="mb-8 w-full rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 text-left flex items-start gap-3 shadow-inner">
          <Bug className="h-5 w-5 text-amber-600 mt-0.5 shrink-0" />
          <p className="font-semibold leading-snug">
            {userFriendlyReason}
          </p>
        </div>
        
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center mb-6">
          <Button size="lg" variant="primary" onClick={() => reset()} className="w-full font-bold sm:w-auto shadow-md">
            {dict.retry}
          </Button>
          <Link href={`/${locale}`} className="w-full sm:w-auto">
            <Button size="lg" variant="secondary" className="w-full font-bold sm:w-auto">
              {dict.home}
            </Button>
          </Link>
        </div>

        <div className="w-full border-t border-slate-100 pt-6">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="flex items-center justify-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors mx-auto"
          >
            {showDetails ? dict.hideDetails : dict.showDetails}
            {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          
          {showDetails && (
            <div className="mt-4 rounded-xl bg-slate-900 p-5 text-left text-xs font-mono text-slate-300 overflow-x-auto shadow-inner w-full">
              <p className="text-red-400 font-bold mb-2">{error.name || "Error"}: {error.message}</p>
              {error.digest && <p className="mb-2 text-slate-400">Digest: <span className="text-blue-300">{error.digest}</span></p>}
              {error.stack && (
                <pre className="whitespace-pre-wrap leading-relaxed opacity-80 mt-4 border-t border-slate-700 pt-4">
                  {error.stack}
                </pre>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
