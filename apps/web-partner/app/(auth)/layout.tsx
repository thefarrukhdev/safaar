import type { ReactNode } from "react";
import Image from "next/image";
import { Sparkles, ShieldCheck, CheckCircle2 } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-slate-50 text-slate-900 selection:bg-blue-500 selection:text-white p-4 sm:p-6 md:p-10"
      style={{
        colorScheme: "light",
        "--background": "#f7f9fc",
        "--foreground": "#0f172a",
        "--surface": "#ffffff",
        "--surface-muted": "#f2f6fb",
        "--surface-hover": "#edf4fb",
        "--border": "#dfe5ec",
        "--border-strong": "#c4ceda",
        "--muted-foreground": "#5f6f82",
      } as React.CSSProperties}
    >
      {/* Background Orbs & Subtle Grid (web-user style) */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* Soft Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:4rem_4rem] opacity-50" />
        
        {/* Glowing Gradient Orbs */}
        <div className="absolute -top-32 -left-32 h-[550px] w-[550px] rounded-full bg-blue-400/20 blur-[130px]" />
        <div className="absolute -bottom-32 -right-32 h-[550px] w-[550px] rounded-full bg-orange-300/25 blur-[130px]" />
        <div className="absolute top-1/3 right-1/4 h-[350px] w-[350px] rounded-full bg-indigo-300/20 blur-[100px]" />
      </div>

      <div className="relative z-10 w-full max-w-5xl grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        {/* Left Side: Branding Hero Showcase */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-between h-full py-4 pr-2">
          <div>
            {/* Brand Logo Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <Image
                  src="/logo.png"
                  alt="Safaar"
                  width={140}
                  height={53}
                  priority
                  className="h-10 w-auto object-contain"
                />
                <span className="text-xs px-2.5 py-1 rounded-full bg-orange-100 text-orange-700 font-semibold border border-orange-200 shadow-sm">
                  Partner
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Hamkorlar Boshqaruv Portali</p>
            </div>

            <div className="space-y-6">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 leading-tight">
                Joylashtirish va <br />
                <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-orange-500 bg-clip-text text-transparent">
                  Ijara Biznesingizni
                </span> Boshqaring
              </h2>
              <p className="text-sm text-slate-600 leading-relaxed font-normal">
                Mehmonxona, Hostel, Dacha, Restoran va Transport vositalaringizni Safaar platformasida osongina ro'yxatdan o'tkazing va buyurtmalarni jonli kuzating.
              </p>

              {/* Feature Cards */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm backdrop-blur-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Aqlli Bandlik Kalendari</p>
                    <p className="text-[11px] text-slate-500">Xona va stollar bandligini bir joyda kuzatib boring</p>
                  </div>
                </div>

                <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-sm backdrop-blur-md">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                    <ShieldCheck className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-slate-900">Kafolatlangan To'lovlar</p>
                    <p className="text-[11px] text-slate-500">Shaffof moliya va har haftalik to'lov tushumlari</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Trust Badge */}
          <div className="pt-8 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between font-medium">
            <span>© {new Date().getFullYear()} Safaar.uz</span>
            <span className="flex items-center gap-1.5 text-emerald-600 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              Tizim ishlamoqda
            </span>
          </div>
        </div>

        {/* Right Side: Clean White Auth Container */}
        <div className="lg:col-span-7 flex flex-col justify-center">
          <div className="relative rounded-3xl border border-slate-200/90 bg-white p-6 sm:p-8 md:p-10 shadow-xl shadow-slate-200/50">
            {/* Mobile Header */}
            <div className="lg:hidden flex items-center justify-between gap-3 mb-6 pb-6 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <Image
                  src="/logo.png"
                  alt="Safaar"
                  width={120}
                  height={45}
                  priority
                  className="h-8 w-auto object-contain"
                />
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 font-semibold border border-orange-200">
                  Partner
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium">Hamkor Kabineti</p>
            </div>

            {children}
          </div>
        </div>
      </div>
    </div>
  );
}


