"use client";

import { AlertOctagon, RotateCcw } from "lucide-react";
import uzErrors from "@/locales/uz/errors.json";
import "./globals.css";

/**
 * Global error boundary — root layout ham yiqilgan holatlar uchun.
 * O'zining `<html>`/`<body>` ini render qiladi.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const dict = uzErrors.error;

  return (
    <html lang="uz">
      <body className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-20 text-center antialiased">
        <div className="flex w-full max-w-xl flex-col items-center justify-center rounded-3xl border border-slate-200 bg-white p-8 sm:p-12 shadow-sm">
          <div className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-red-50 border border-red-100">
            <AlertOctagon className="h-12 w-12 text-red-500" />
          </div>
          
          <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
            Tizimda jiddiy xatolik
          </h1>
          
          <p className="mb-8 text-base font-medium leading-relaxed text-slate-600">
            Kechirasiz, kutilmagan xatolik yuz berdi va dastur ishlashdan to'xtadi. Iltimos, sahifani qayta yuklang yoki birozdan so'ng yana urinib ko'ring.
          </p>
          
          <div className="w-full max-w-sm rounded-xl bg-slate-900 p-4 text-left text-xs font-mono text-slate-300 mb-8 overflow-x-auto shadow-inner">
            <p className="text-red-400 font-bold mb-1">{error.name || "Error"}: {error.message}</p>
            {error.digest && <p className="text-slate-400">Digest: <span className="text-blue-300">{error.digest}</span></p>}
          </div>

          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 px-6 text-lg font-bold text-white transition-all hover:bg-blue-700 active:scale-[0.98] shadow-md sm:w-auto"
          >
            <RotateCcw className="h-5 w-5" />
            Sahifani qayta yuklash
          </button>
        </div>
      </body>
    </html>
  );
}
