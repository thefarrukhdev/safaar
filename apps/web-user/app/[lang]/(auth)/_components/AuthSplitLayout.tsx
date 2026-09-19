import type { ReactNode } from "react";
import type { Locale } from "@/i18n/config";
import type { AuthDict } from "@/i18n/dictionaries";
import { BackButton } from "@/components/ui/BackButton";
import { LocaleSwitcher } from "@/components/layout/LocaleSwitcher";
import dynamic from "next/dynamic";
const MaskedHeading = dynamic(() => import("@/components/reactbits/MaskedHeading"), { ssr: false });

interface AuthSplitLayoutProps {
  children: ReactNode;
  locale: Locale;
  dict: AuthDict;
}

/**
  * AuthSplitLayout - Kop ishlatiladigan 50/50 split desktop dizayni uchun wrapper.
  * Chap tomonda premium brending banneri, o'ng tomonda esa forma,
  * orqaga qaytish va til almashtirish tugmalari joylashgan.
  */
export function AuthSplitLayout({ children, locale, dict }: AuthSplitLayoutProps) {
  return (
    <div className="flex flex-1 flex-col lg:flex-row w-full bg-card">
      {/* Left panel: Safaar branding (Desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center items-center text-center p-16 bg-primary-600 text-white relative select-none rounded-r-[2.5rem] border-r-8 border-black shadow-lg">
        {/* Brand & Hero Slogan Grouped (Vertically Centered) */}
        <div className="my-auto max-w-md space-y-8 relative z-10">
          {/* Brand indicator */}
          <div className="flex justify-center items-center gap-2 w-full">
            <MaskedHeading
              text="SAFAAR"
              src="/Bukhara-old-city-golden-hour.jpeg"
              reveal="rise"
              duration={1.2}
              align="center"
              weight={900}
              textScale={0.20}
            />
          </div>

          {/* Hero slogan / value proposition */}
          <div className="w-full flex justify-center items-center mt-6">
            <h2 className="text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl text-white text-center animate-in fade-in slide-in-from-bottom-4 duration-1000 fill-mode-both delay-300">
              {dict.bannerTitle}
            </h2>
          </div>
        </div>
      </div>

      {/* Right panel: Auth form */}
      <div className="flex flex-1 flex-col justify-center items-center px-4 py-12 lg:w-1/2 lg:px-12 relative pt-24 lg:pt-12 bg-slate-50">
        {/* Actions header (Back button + Locale switcher) */}
        <div className="absolute top-6 left-6 right-6 flex items-center justify-between z-20">
          <BackButton />
          <LocaleSwitcher current={locale} light />
        </div>
        <div className="w-full max-w-[420px] space-y-6 bg-card border border-slate-100 shadow-card rounded-xl p-6 sm:p-8 transition-all duration-300 hover:shadow-card-hover">
          {children}
        </div>
      </div>
    </div>
  );
}
