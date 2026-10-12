import { ShieldCheck, ArrowRight, FileSearch, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Header & Title */}
      <div className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/50 border border-blue-100/80 dark:border-blue-900/60 text-[11px] font-semibold text-blue-700 dark:text-blue-300 w-fit">
          <Sparkles className="h-3 w-3 text-blue-600 dark:text-blue-400" />
          <span>Hamkorlik Portali</span>
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Tizimga Kirish
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-normal">
          Boshqaruv paneliga kirish uchun telefon raqam va parolingizni kiriting.
        </p>
      </div>

      {/* Info Callout */}
      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl bg-gradient-to-r from-blue-50/90 to-indigo-50/50 dark:from-blue-950/40 dark:to-indigo-950/30 border border-blue-100/90 dark:border-blue-900/60 px-4 py-3 text-xs text-blue-950 dark:text-blue-200 shadow-2xs"
      >
        <div className="p-1 rounded-lg bg-blue-100/80 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 shrink-0 mt-0.5">
          <ShieldCheck className="h-4 w-4" aria-hidden />
        </div>
        <p className="leading-relaxed">
          <strong className="font-semibold text-blue-900 dark:text-blue-200">Eslatma:</strong> Avval hamkorlik arizasi yuboriladi, admin tasdiqlagandan so'ng kabinetga to'liq kirish imkoni ochiladi.
        </p>
      </div>

      {/* Main Form Component */}
      <LoginForm />

      {/* Footer Navigation */}
      <div className="border-t border-slate-100 dark:border-slate-800 pt-5 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 font-medium px-0.5">
          <span>Hali hamkor emasmisiz?</span>
          <span>Arizangiz bormi?</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/register" className="w-full group">
            <div className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all group-hover:bg-slate-100 dark:group-hover:bg-slate-800 group-hover:border-slate-300 dark:group-hover:border-slate-600 group-hover:text-slate-900 dark:group-hover:text-slate-100 cursor-pointer shadow-2xs active:scale-[0.98]">
              <span>Ariza berish</span>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 group-hover:translate-x-0.5 transition-all" />
            </div>
          </Link>
          <Link href="/status" className="w-full group">
            <div className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all group-hover:bg-slate-100 dark:group-hover:bg-slate-800 group-hover:text-slate-900 dark:group-hover:text-slate-100 group-hover:border-slate-300 dark:group-hover:border-slate-600 cursor-pointer shadow-2xs active:scale-[0.98]">
              <FileSearch className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors" />
              <span>Holatni tekshirish</span>
            </div>
          </Link>
        </div>
      </div>
    </div>
  );
}

