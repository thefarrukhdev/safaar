import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 text-slate-900 px-4 py-8 sm:py-12">
      {/* Brand Header */}
      <div className="mb-6 flex flex-col items-center text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2.5 transition-opacity hover:opacity-90"
        >
          <Image
            src="/logo.png"
            alt="Safaar"
            width={124}
            height={46}
            priority
            className="h-8 w-auto object-contain"
          />
          <span className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700 shadow-2xs">
            Partner
          </span>
        </Link>
        <p className="mt-2 text-xs text-slate-500 font-medium">
          Hamkorlar Boshqaruv Portali
        </p>
      </div>

      {/* Auth Card Container */}
      <main className="w-full max-w-[440px]">
        <div className="rounded-2xl border border-slate-200/90 bg-white p-6 sm:p-8 shadow-xs">
          {children}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="mt-8 text-center text-xs text-slate-400">
        © {new Date().getFullYear()} Safaar.uz · Barcha huquqlar himoyalangan
      </footer>
    </div>
  );
}
