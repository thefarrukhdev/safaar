import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSession } from "@/lib/auth/session";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { PromoBarLive } from "@/components/layout/PromoBarLive";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { getPromoBarConfig } from "@/lib/promo";
import { RealtimeProvider } from "@/lib/services/realtime/socket-provider";
import nextDynamic from "next/dynamic";

const LiveSupportWidget = nextDynamic(
  () => import("@/components/chat/LiveSupportWidget").then((mod) => mod.LiveSupportWidget)
);

export const dynamic = "force-dynamic";

/**
 * Main layout — SiteHeader + PromoBar + Footer.
 * Barcha sahifalar (login'dan tashqari) shu layout ichida.
 */
export default async function MainLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = (isLocale(lang) ? lang : "uz") as Locale;

  const [common, session, promoConfig] = await Promise.all([
    getDictionary(locale, "common"),
    getSession(),
    getPromoBarConfig(locale),
  ]);

  return (
    <RealtimeProvider accessToken={session?.accessToken ?? null}>
      <PromoBarLive initialConfig={promoConfig} locale={locale} />
      <SiteHeader locale={locale} dict={common} authed={!!session} />
      <div className="flex flex-1 flex-col bg-slate-100/60 dark:bg-slate-950">{children}</div>
      <SiteFooter locale={locale} dict={common} />
      <LiveSupportWidget />
    </RealtimeProvider>
  );
}
