import Link from"next/link";
import Image from"next/image";
import { Mail, MapPin, Camera, Send } from"lucide-react";
import type { Locale } from"@/i18n/config";
import type { CommonDict } from"@/i18n/dictionaries";
import { BrandLogo } from"@/components/ui/BrandLogo";

interface PaymentMethod {
 name: string;
 logo?: string;
}

const PAYMENT_METHODS: PaymentMethod[] = [
 { name:"Click"},
 { name:"Payme"},
 { name:"Humo"},
 { name:"UzCard"},
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
 platform:"Platforma",
 company:"Kompaniya",
 partners:"Hamkorlik",
 contact:"Aloqa",
 };
 const paymentMethods = PAYMENT_METHODS;

 return (
 <footer className="mt-auto bg-black text-slate-300">
 <div className="mx-auto w-full md:w-[96%] max-w-[1536px] px-3 sm:px-4 md:px-8 py-12 lg:py-16">
 <div className="flex flex-col gap-10 lg:flex-row lg:justify-between lg:gap-16">
 {/* Col 1: Brand & Intro */}
 <div className="flex flex-col gap-6 lg:w-1/3">
 <BrandLogo href={base} brand={dict.brand} variant="dark"/>
 
 <div className="flex flex-col gap-3 text-sm text-slate-400">
 <span className="leading-relaxed">{dict.footer.secureBooking}</span>
 <div className="mt-2 flex flex-wrap items-center gap-2 opacity-80 transition-opacity hover:opacity-100">
 <div className="relative h-7 w-11 overflow-hidden rounded bg-white p-0.5">
 <Image src="/payments/uzcard.jpg" alt="Uzcard" fill className="object-contain" sizes="44px"/>
 </div>
 <div className="relative h-7 w-11 overflow-hidden rounded bg-white p-0.5">
 <Image src="/payments/humo.png" alt="Humo" fill className="object-contain" sizes="44px"/>
 </div>
 <div className="relative h-7 w-11 overflow-hidden rounded bg-white p-0.5">
 <Image src="/payments/visa.jpeg" alt="Visa" fill className="object-contain" sizes="44px"/>
 </div>
 <div className="relative h-7 w-11 overflow-hidden rounded bg-white p-0.5">
 <Image src="/payments/mastercard.jpg" alt="Mastercard" fill className="object-contain" sizes="44px"/>
 </div>
 <div className="relative ml-1 h-7 w-14 overflow-hidden rounded bg-white p-1">
 <Image src="/payments/3dsecure.jpg" alt="3D Secure" fill className="object-contain" sizes="56px"/>
 </div>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:w-2/3 lg:gap-12">
 {/* Col 2: Platform */}
 <div className="flex flex-col gap-4">
 <h3 className="text-[15px] font-bold tracking-wide text-white">{sections.platform}</h3>
 <nav className="flex flex-col gap-3 text-[14px] text-slate-400">
 <Link
 href={`${base}/hotels`}
 className="w-fit transition-colors hover:text-white"
 >
 {dict.nav.hotels}
 </Link>
 <Link
 href={`${base}/transport`}
 className="w-fit transition-colors hover:text-white"
 >
 {dict.nav.transport}
 </Link>
 <Link
 href={`${base}/attractions`}
 className="w-fit transition-colors hover:text-white"
 >
 {dict.nav.attractions}
 </Link>
 </nav>
 </div>

 {/* Col 3: Company */}
 <div className="flex flex-col gap-4">
 <h3 className="text-[15px] font-bold tracking-wide text-white">{sections.company}</h3>
 <nav className="flex flex-col gap-3 text-[14px] text-slate-400">
 <Link
 href={`${base}/about`}
 className="w-fit transition-colors hover:text-white"
 >
 {dict.nav.about}
 </Link>
 <Link
 href={`${base}/help`}
 className="w-fit transition-colors hover:text-white"
 >
 {dict.nav.help}
 </Link>
 <Link
 href={`${base}/terms`}
 className="w-fit transition-colors hover:text-white"
 >
 {dict.nav.terms}
 </Link>
 <a
 href="https://partner.safaar.uz"
 target="_blank"
 rel="noopener noreferrer"
 className="mt-1 w-fit font-semibold text-amber-400 transition-colors hover:text-amber-300"
 >
 {dict.footer.partner}
 </a>
 </nav>
 </div>

 {/* Col 4: Contact */}
 <div className="col-span-2 flex flex-col gap-4 sm:col-span-1">
 <h3 className="text-[15px] font-bold tracking-wide text-white">{sections.contact}</h3>
 <ul className="flex flex-col gap-3 text-[14px] text-slate-400">
 <li className="flex items-start gap-3">
 <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-blue-500"/>
 <span className="leading-relaxed">
 {(dict.footer as any).address ||"Samarqand shahri"}
 </span>
 </li>
 <li className="flex items-center gap-3">
 <Mail className="h-4 w-4 shrink-0 text-blue-500"/>
 <a
 href={`mailto:${dict.footer.email}`}
 className="w-fit transition-colors hover:text-white"
 >
 {dict.footer.email}
 </a>
 </li>
 </ul>
 </div>
 </div>
 </div>

 {/* Copyright */}
 <div className="mt-12 flex flex-col items-center justify-center gap-4 border-t border-slate-800/60 pt-8 sm:mt-16 sm:flex-row sm:justify-between text-center sm:text-left">
 <p className="text-[13px] text-slate-400">
 © {year} {dict.brand}. {dict.footer.rights}
 </p>
 </div>
 </div>
 </footer>
 );
}
