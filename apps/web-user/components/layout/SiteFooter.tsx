import Link from "next/link";
import Image from "next/image";
import { Mail, MapPin, Camera, Send } from "lucide-react";
import type { Locale } from "@/i18n/config";
import type { CommonDict } from "@/i18n/dictionaries";
import { BrandLogo } from "@/components/ui/BrandLogo";

interface PaymentMethod {
  name: string;
  logo?: string;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  { name: "Click" },
  { name: "Payme" },
  { name: "Humo" },
  { name: "UzCard" },
];

export function SiteFooter({
  locale,
  dict,
}: {
  locale: Locale;
  dict: CommonDict;
}) {
  const base = `/${locale}`;
  const year = new Date().getFullYear();
  const footerData = dict.footer as Record<string, unknown>;
  const sections = (footerData.sections as Record<string, string>) || {
    platform: "Platforma",
    company: "Kompaniya",
    partners: "Hamkorlik",
    contact: "Aloqa",
  };
  const paymentMethods = PAYMENT_METHODS;

  return (
    <footer className="mt-auto bg-black text-slate-300">
      <div className="mx-auto w-full md:w-[96%] max-w-[1536px] px-3 sm:px-4 md:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 md:grid-cols-4 lg:gap-12">
          {/* Col 1: Brand & Intro */}
          <div className="flex flex-col gap-5">
            <BrandLogo href={base} brand={dict.brand} variant="dark" />
            
            <div className="flex flex-col gap-3 text-xs text-slate-400 mt-2">
              <span>{dict.footer.secureBooking}</span>
              <div className="flex items-center -space-x-1.5 opacity-80 transition-opacity hover:opacity-100">
                <div className="relative z-50 h-6 w-10 overflow-hidden rounded border border-white/10 bg-white shadow-sm ring-1 ring-black/5">
                  <Image src="/payments/uzcard.jpg" alt="Uzcard" fill className="object-contain p-0.5" sizes="40px" />
                </div>
                <div className="relative z-40 h-6 w-10 overflow-hidden rounded border border-white/10 bg-white shadow-sm ring-1 ring-black/5">
                  <Image src="/payments/humo.png" alt="Humo" fill className="object-contain p-0.5" sizes="40px" />
                </div>
                <div className="relative z-30 h-6 w-10 overflow-hidden rounded border border-white/10 bg-white shadow-sm ring-1 ring-black/5">
                  <Image src="/payments/visa.jpeg" alt="Visa" fill className="object-contain p-0.5" sizes="40px" />
                </div>
                <div className="relative z-20 h-6 w-10 overflow-hidden rounded border border-white/10 bg-white shadow-sm ring-1 ring-black/5">
                  <Image src="/payments/mastercard.jpg" alt="Mastercard" fill className="object-contain p-0.5" sizes="40px" />
                </div>
                <div className="relative z-10 ml-2 h-6 w-12 overflow-hidden rounded border border-white/10 bg-white shadow-sm ring-1 ring-black/5">
                  <Image src="/payments/3dsecure.jpg" alt="3D Secure" fill className="object-contain p-1" sizes="48px" />
                </div>
              </div>
            </div>
          </div>

          {/* Col 2: Platform */}
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-white">{sections.platform}</h3>
            <nav className="flex flex-col gap-3 text-sm">
              <Link
                href={`${base}/hotels`}
                className="transition-colors hover:text-white hover:underline"
              >
                {dict.nav.hotels}
              </Link>
              <Link
                href={`${base}/dachas`}
                className="transition-colors hover:text-white hover:underline"
              >
                {dict.nav.dachas}
              </Link>
              <Link
                href={`${base}/transport`}
                className="transition-colors hover:text-white hover:underline"
              >
                {dict.nav.transport}
              </Link>
              <Link
                href={`${base}/attractions`}
                className="transition-colors hover:text-white hover:underline"
              >
                {dict.nav.attractions}
              </Link>
            </nav>
          </div>

          {/* Col 3: Company */}
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-white">{sections.company}</h3>
            <nav className="flex flex-col gap-3 text-sm">
              <Link
                href={`${base}/about`}
                className="transition-colors hover:text-white hover:underline"
              >
                {dict.nav.about}
              </Link>
              <Link
                href={`${base}/help`}
                className="transition-colors hover:text-white hover:underline"
              >
                {dict.nav.help}
              </Link>
              <Link
                href={`${base}/terms`}
                className="transition-colors hover:text-white hover:underline"
              >
                {dict.nav.terms}
              </Link>
              <a
                href="https://partner.safaar.uz"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 font-semibold text-amber-400 transition-colors hover:text-amber-300 hover:underline"
              >
                {dict.footer.partner}
              </a>
            </nav>
          </div>

          {/* Col 4: Contact */}
          <div className="flex flex-col gap-4">
            <h3 className="text-base font-bold text-white">{sections.contact}</h3>
            <ul className="flex flex-col gap-3 text-sm">
              <li className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary-500" />
                <span className="leading-relaxed">
                  {(dict.footer as any).address || "Samarqand shahri"}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="h-4 w-4 shrink-0 text-primary-500" />
                <a
                  href={`mailto:${dict.footer.email}`}
                  className="transition-colors hover:text-white hover:underline"
                >
                  {dict.footer.email}
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-8 flex flex-col items-center justify-between gap-6 sm:mt-12 sm:flex-row">
          <p className="text-xs text-slate-400">
            © {year} {dict.brand}. {dict.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}
