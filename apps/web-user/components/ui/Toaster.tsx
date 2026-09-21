"use client";

import { Toaster as Sonner } from "sonner";
import { CheckCircle2, AlertCircle, Info, XCircle } from "lucide-react";

export function Toaster() {
  return (
    <Sonner
      position="top-right"
      toastOptions={{
        classNames: {
          toast:
            "group flex items-start gap-3 w-full rounded-xl border p-4 shadow-xl backdrop-blur-md transition-all sm:max-w-[420px]",
          title: "text-sm font-semibold",
          description: "mt-1 text-sm opacity-90",
          actionButton: "mt-3 bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-primary-500 rounded-md",
          cancelButton: "mt-3 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-slate-200 rounded-md dark:bg-slate-800 dark:text-slate-100",
          
          // Custom Variants
          success: "border-emerald-500/20 bg-emerald-50/90 text-emerald-900 dark:border-emerald-500/20 dark:bg-emerald-950/90 dark:text-emerald-100",
          error: "border-red-500/20 bg-red-50/90 text-red-900 dark:border-red-500/20 dark:bg-red-950/90 dark:text-red-100",
          info: "border-blue-500/20 bg-blue-50/90 text-blue-900 dark:border-blue-500/20 dark:bg-blue-950/90 dark:text-blue-100",
          warning: "border-amber-500/20 bg-amber-50/90 text-amber-900 dark:border-amber-500/20 dark:bg-amber-950/90 dark:text-amber-100",
          default: "border-slate-200 bg-white/90 text-slate-900 dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-100",
        },
      }}
      icons={{
        success: <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
        error: <XCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />,
        info: <Info className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />,
        warning: <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
      }}
    />
  );
}
