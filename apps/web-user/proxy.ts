/**
 * Locale redirect (Next.js 16: `middleware` → `proxy`).
 *
 * URL'da til prefiksi bo'lmasa (`/hotels`), foydalanuvchi brauzeri tiliga qarab
 * mos tilga yo'naltiramiz (`/uz/hotels`). Tashqi kutubxonasiz — `Accept-Language`
 * headerini o'zimiz tahlil qilamiz.
 */
import { NextResponse, type NextRequest } from "next/server";
import { locales, defaultLocale } from "@/i18n/config";

function pickLocale(): string {
  // Always default to Uzbek (defaultLocale) as requested by the user,
  // ignoring browser's accept-language header.
  return defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Do not rewrite or redirect internal routes, APIs, or payment callbacks
  if (pathname.startsWith("/api") || pathname.startsWith("/payment")) {
    return;
  }

  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );
  if (hasLocale) return;

  const locale = pickLocale();
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return NextResponse.redirect(request.nextUrl);
}

export const config = {
  // _next ichki yo'llari, api, payment va fayllarni (kengaytmasi borlar) o'tkazib yuboramiz.
  matcher: ["/((?!_next|api|payment|.*\\..*).*)"],
};
