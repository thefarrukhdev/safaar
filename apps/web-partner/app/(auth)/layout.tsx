import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  SpotlightBackground,
  SpotlightCard,
} from "./_components/spotlight-background";
import { AuthHelpDrawer } from "./_components/auth-help-drawer";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <SpotlightBackground>
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
          <span className="rounded-md border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-700 shadow-2xs">
            Partner
          </span>
        </Link>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
          Hamkorlar Boshqaruv Portali
        </p>
      </div>

      {/* Auth Card Container with Beam Edge Effect */}
      <main className="w-full max-w-[440px]">
        <SpotlightCard>{children}</SpotlightCard>
      </main>

      {/* Minimal Footer */}
      <footer className="mt-8 text-center text-xs text-slate-400 dark:text-slate-500">
        © {new Date().getFullYear()} Safaar.uz · Barcha huquqlar himoyalangan
      </footer>

      {/* Floating Question-Mark Help Button & Slide-over Drawer */}
      <AuthHelpDrawer />
    </SpotlightBackground>
  );
}
