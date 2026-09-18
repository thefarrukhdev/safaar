import { ShieldCheck, ArrowRight, FileSearch } from 'lucide-react';
import Link from 'next/link';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          Tizimga Kirish
        </h2>
        <p className="text-sm text-slate-500">
          Email manzil va parolingizni kiritib tizimga kiring.
        </p>
      </div>

      <div
        role="status"
        className="flex items-start gap-3 rounded-2xl bg-blue-50 border border-blue-100 px-4 py-3 text-xs text-blue-900"
      >
        <ShieldCheck
          className="mt-0.5 h-4 w-4 shrink-0 text-blue-600"
          aria-hidden
        />
        <p className="leading-relaxed">
          <strong className="text-blue-900 font-semibold">Eslatma:</strong> Avval hamkorlik arizasi yuboriladi, admin tasdiqlagandan so'ng kabinetga kirish imkoni ochiladi.
        </p>
      </div>

      <LoginForm />

      <div className="border-t border-slate-100 pt-5 flex flex-col gap-3">
        <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
          <span>Hali hamkor emasmisiz?</span>
          <span>Arizangiz bormi?</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Link href="/register" className="w-full">
            <button className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition-all hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700 cursor-pointer">
              Ariza berish
              <ArrowRight className="h-3.5 w-3.5 text-blue-600" />
            </button>
          </Link>
          <Link href="/status" className="w-full">
            <button className="w-full flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50 hover:text-slate-900 cursor-pointer">
              <FileSearch className="h-3.5 w-3.5 text-slate-500" />
              Holatni tekshirish
            </button>
          </Link>
        </div>
      </div>
    </div>
  );
}
