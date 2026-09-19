import { Loader2 } from "lucide-react";

export default function GlobalLoading() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100/60 backdrop-blur-sm dark:bg-slate-950/60">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600 dark:text-primary-500" />
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-400 animate-pulse">
          Yuklanmoqda...
        </p>
      </div>
    </div>
  );
}
