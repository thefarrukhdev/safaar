"use client";

import { AlertOctagon } from "lucide-react";

/**
 * Global error boundary — root layout ham yiqilgan holatlar uchun.
 * O'zining `<html>`/`<body>` ini render qiladi.
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="uz">
      <body
        style={{ margin: 0 }}
        className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-6 py-20 text-center dark:bg-slate-950"
      >
        <div className="flex max-w-md flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-8 shadow-xl dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertOctagon className="h-10 w-10 text-red-600 dark:text-red-500" />
          </div>
          
          <h1 className="mb-3 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl dark:text-white">
            Tizimda jiddiy xatolik 🛠
          </h1>
          
          <p className="mb-8 text-sm font-medium text-slate-600 dark:text-slate-400">
            Kechirasiz, kutilmagan xatolik yuz berdi va dastur ishlashdan to'xtadi. Iltimos, sahifani qayta yuklang yoki birozdan so'ng yana urinib ko'ring.
          </p>
          
          <button
            type="button"
            onClick={() => reset()}
            className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-primary-600 px-6 text-base font-bold text-white shadow-md transition-all hover:bg-primary-700 hover:shadow-lg active:scale-[0.98]"
          >
            Sahifani qayta yuklash
          </button>
        </div>
      </body>
    </html>
  );
}
