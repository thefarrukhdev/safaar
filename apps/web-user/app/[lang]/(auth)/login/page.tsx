import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSession } from "@/lib/auth/session";
import LampAuth from "@/components/features/auth/LampAuth";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale, "auth");
  return {
    title: dict.title,
    robots: { index: false, follow: false },
  };
}

export default async function LoginPage({
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
  const socialErrorRaw = sp.socialError;
  const socialError =
    typeof socialErrorRaw === "string" ? socialErrorRaw : undefined;

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

  return (
    <LampAuth
      initialIsLogin={true}
      next={next}
      dict={dict}
      socialError={socialError}
    />
  );
}
