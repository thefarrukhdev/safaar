"use client";

import { useState } from "react";
import Link from "next/link";
import {
  HelpCircle,
  FileCheck2,
  MessageCircle,
  PhoneCall,
  Search,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";
import { Drawer } from "../../_components/ui/drawer";

export function AuthHelpDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating Trigger Button (Bottom-Right, Accessible 44px Touch Target with Safe-Area Offset) */}
      <aside aria-label="Yordam va qo'llab-quvvatlash">
        <button
          type="button"
          onClick={() => setOpen(true)}
          title="Yordam & Yo'riqnoma"
          aria-label="Hamkorlik bo'yicha yordam va yo'riqnoma"
          style={{ bottom: "calc(1rem + env(safe-area-inset-bottom, 0px))" }}
          className="fixed right-4 z-40 flex h-11 w-11 min-h-[44px] min-w-[44px] items-center justify-center rounded-full border border-slate-200/90 bg-white/90 text-slate-500 shadow-2xs backdrop-blur-md transition-all hover:border-slate-300 hover:bg-white hover:text-blue-600 hover:shadow-xs active:scale-95 cursor-pointer dark:border-slate-800 dark:bg-slate-900/90 dark:text-slate-400 dark:hover:text-blue-400 bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]"
        >
          <HelpCircle className="h-5 w-5" aria-hidden="true" />
        </button>
      </aside>

      {/* Slide-over Right Drawer */}
      <Drawer
        open={open}
        onClose={() => setOpen(false)}
        title="Hamkorlik bo'yicha yo'riqnoma"
        description="Safaar boshqaruv paneliga kirish, ro'yxatdan o'tish va ariza tasdiqlanishi bo'yicha ma'lumotlar"
        size="md"
      >
        <div className="flex flex-col gap-6 text-sm">
          {/* Section 1: Process Steps */}
          <div className="flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Qanday ishlaydi? (3 bosqich)
            </h3>
            <div className="flex flex-col gap-2.5">
              <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-bold text-xs">
                  1
                </span>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    Ariza topshirish
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Obyekt turi (mehmonxona, dacha, hostel va h.k.), shahar, telefon raqam va parolingizni kiritib ariza qoldirasiz (atigi 2 daqiqa).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 font-bold text-xs">
                  2
                </span>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    Admin tekshiruvi (Moderatsiya)
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Arizangiz moderatormiz tomonidan 1 ish kuni davomida ko&apos;rib chiqiladi va tasdiqlanadi.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3.5 dark:border-slate-800 dark:bg-slate-900/50">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-bold text-xs">
                  3
                </span>
                <div>
                  <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                    Kabinetga to&apos;liq kirish
                  </h4>
                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                    Tasdiqlangandan so&apos;ng telefon raqamingiz va parolingiz orqali tizimga kirib, xonalar va bronlarni boshqarishni boshlaysiz.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Quick Links */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Tezkor amallar
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Link
                href="/status"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-all dark:border-slate-800 dark:bg-slate-900 group"
              >
                <div className="flex items-center gap-2.5">
                  <Search className="h-4 w-4 text-blue-600" aria-hidden="true" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Holatni tekshirish
                  </span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </Link>

              <Link
                href="/register"
                onClick={() => setOpen(false)}
                className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-white p-3 hover:border-blue-300 hover:bg-blue-50/40 transition-all dark:border-slate-800 dark:bg-slate-900 group"
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="h-4 w-4 text-emerald-600" aria-hidden="true" />
                  <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                    Ariza topshirish
                  </span>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-600 transition-colors" />
              </Link>
            </div>
          </div>

          {/* Section 3: FAQ */}
          <div className="flex flex-col gap-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Ko&apos;p so&apos;raladigan savollar
            </h3>
            <div className="space-y-2">
              <details className="group rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>Parolimni unutdim, qanday tiklayman?</span>
                  <span className="transition-transform group-open:rotate-180 text-slate-400">▾</span>
                </summary>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-2">
                  Kirish sahifasida &quot;Parolni unutdingizmi?&quot; tugmasini bosing. Telefon raqamingizga SMS kod keladi va uni tasdiqlab yangi parol o&apos;rnatasiz.
                </p>
              </details>

              <details className="group rounded-xl border border-slate-200/80 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-900/30">
                <summary className="flex cursor-pointer items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
                  <span>Ariza topshirgach darhol kira olamanmi?</span>
                  <span className="transition-transform group-open:rotate-180 text-slate-400">▾</span>
                </summary>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-2">
                  Xavfsizlik va sifatni ta&apos;minlash maqsadida har bir obyekt avval administratorlar tomonidan tekshiriladi. Tasdiqlangandan so&apos;ng darhol to&apos;liq kirish ochiladi.
                </p>
              </details>
            </div>
          </div>

          {/* Section 4: Live Support Contact */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-900/40 dark:bg-blue-950/20">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <h4 className="text-xs font-bold text-blue-900 dark:text-blue-200">
                Yordam kerakmi? Biz aloqadamiz
              </h4>
            </div>
            <p className="text-xs text-blue-800/80 dark:text-blue-300 leading-relaxed mb-3">
              Savollaringiz yoki qiyinchiliklar bo&apos;lsa, mutaxassislarimiz yordam berishga tayyor.
            </p>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <a
                href="https://t.me/safaar_support"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 font-semibold text-white hover:bg-blue-700 transition-colors cursor-pointer"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Telegram yordam
              </a>
              <a
                href="tel:+998712000000"
                className="inline-flex items-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 font-semibold text-blue-900 hover:bg-blue-50 transition-colors cursor-pointer dark:border-blue-800 dark:bg-slate-900 dark:text-blue-200"
              >
                <PhoneCall className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                Qo&apos;ng&apos;iroq qilish
              </a>
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
}
