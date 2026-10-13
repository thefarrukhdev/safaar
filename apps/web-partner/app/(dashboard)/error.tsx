"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCcw, Home } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "../_components/ui/button";

export default function DashboardErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("Dashboard qismida xatolik yuz berdi:", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] w-full flex-col items-center justify-center p-4 text-center">
      <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-zinc-200/80 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400">
          <AlertTriangle className="h-7 w-7" />
        </div>

        <h2 className="mb-2 text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
          Ushbu bo'limda xatolik yuz berdi
        </h2>

        <p className="mb-6 text-sm text-zinc-500 dark:text-zinc-400">
          Ma'lumotlarni yuklashda kutilmagan nosozlik yuzaga keldi. Siz boshqa sahifalarga o'tishingiz yoki qaytadan urinib ko'rishingiz mumkin.
        </p>

        {process.env.NODE_ENV === "development" && error.message && (
          <div className="mb-6 max-h-32 w-full overflow-auto rounded-lg border border-red-100 bg-red-50 p-3 text-left font-mono text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
            {error.message}
          </div>
        )}

        <div className="flex w-full flex-col gap-2.5 sm:flex-row sm:justify-center">
          <Button onClick={() => reset()} className="gap-2 bg-brand-600 text-white hover:bg-brand-700">
            <RefreshCcw size={16} />
            Qayta urinish
          </Button>
          <Button variant="outline" onClick={() => router.push("/")} className="gap-2">
            <Home size={16} />
            Bosh sahifa
          </Button>
        </div>
      </div>
    </div>
  );
}
