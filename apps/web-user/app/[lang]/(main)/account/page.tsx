import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale, "account");
  return { title: dict.nav?.profile, robots: { index: false, follow: false } };
}
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSession } from "@/lib/auth/session";
import { api } from "@/lib/api";
import { Card, CardBody } from "@/components/ui/Card";
import { ProfileForm } from "@/components/account/ProfileForm";
import { SettingsForm } from "@/components/account/SettingsForm";
import type { ProfileView } from "@/types/view";

export default async function AccountProfilePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  // SENIOR OPTIMIZATION: Fetch session and dictionary in parallel
  const [session, dict] = await Promise.all([
    getSession(),
    getDictionary(locale, "account"),
  ]);

  if (!session) {
    redirect(`/${locale}/login?next=${encodeURIComponent(`/${locale}/account`)}`);
  }

  const profile: ProfileView = await api.users.getProfile({ token: session.accessToken });
  const preferences = await api.users.getNotificationPreferences({ token: session.accessToken }).catch(() => null);

  const memberSince = (() => {
    const ts = Date.parse(profile.createdAt);
    return Number.isFinite(ts)
      ? new Date(ts).toLocaleDateString("uz-UZ")
      : profile.createdAt;
  })();

  return (
    <div className="flex flex-col">
    <Card>
      <CardBody className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{dict.profile.title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {dict.profile.memberSince}: {memberSince}
          </p>
        </div>
        <ProfileForm locale={locale} profile={profile} dict={dict.profile} avatarDict={(dict as any).avatar} />
      </CardBody>
    </Card>
    <Card className="mt-6">
      <CardBody>
        <SettingsForm preferences={preferences} dict={dict.settings || {}} />
      </CardBody>
    </Card>
    </div>
  );
}
