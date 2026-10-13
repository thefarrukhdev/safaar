import Link from 'next/link';
import { LoginForm } from './login-form';

export default function LoginPage() {
  return (
    <div className="flex flex-col gap-6">
      {/* Title & Subtitle */}
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">
          Tizimga kirish
        </h1>
        <p className="text-xs text-slate-500 leading-normal">
          Boshqaruv paneliga kirish uchun ma&apos;lumotlaringizni kiriting.
        </p>
      </div>

      {/* Main Form */}
      <LoginForm />

      {/* Minimalist Footer Links */}
      <div className="border-t border-slate-100 pt-5 flex flex-col gap-2 text-center text-xs text-slate-500">
        <p>
          Hali hamkor emasmisiz?{' '}
          <Link
            href="/register"
            className="font-semibold text-blue-600 hover:text-blue-700 hover:underline transition-colors"
          >
            Ariza topshirish
          </Link>
        </p>
        <p>
          Arizangiz bormi?{' '}
          <Link
            href="/status"
            className="font-medium text-slate-600 hover:text-slate-900 hover:underline transition-colors"
          >
            Holatini tekshirish
          </Link>
        </p>
      </div>
    </div>
  );
}
