import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSession } from "@/lib/auth/session";
import { RegisterForm } from "../_components/RegisterForm";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale, "auth");
  return {
    title: dict.registerTitle,
    robots: { index: false, follow: false },
  };
}

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  const sp = await searchParams;
  const nextRaw = sp.next;
  const next = typeof nextRaw === "string" && nextRaw.startsWith("/")
    ? nextRaw
    : "";

  // SENIOR OPTIMIZATION: Parallelize session check and dictionary loading
  const [session, dict] = await Promise.all([
    getSession(),
    getDictionary(locale, "auth"),
  ]);

  if (session) {
    let safeNext = next || `/${locale}`;
    if (safeNext.includes("/login") || safeNext.includes("/register") || safeNext.includes("/auth/")) {
      safeNext = `/${locale}`;
    }
    redirect(safeNext);
  }

  return <RegisterForm locale={locale} next={next} dict={dict} />;
}
