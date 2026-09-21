import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang as Locale, "account");
  return { title: dict.refunds?.title, robots: { index: false, follow: false } };
}

import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSession } from "@/lib/auth/session";
import { api } from "@/lib/services/api";
import { Card, CardBody } from "@/components/ui/Card";
import { Clock } from "lucide-react";

export default async function AccountRefundsPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const locale = lang as Locale;

  const [session, dict] = await Promise.all([
    getSession(),
    getDictionary(locale, "account"),
  ]);

  if (!session) {
    redirect(
      `/${locale}/login?next=${encodeURIComponent(`/${locale}/account/refunds`)}`,
    );
  }

  const refunds = await api.refunds.getMyRefunds({ token: session.accessToken });

  function formatDate(value: string): string {
    const ts = Date.parse(value);
    return Number.isFinite(ts)
      ? new Date(ts).toLocaleDateString("uz-UZ", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        })
      : value;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">
          {dict.refunds?.title}
        </h2>
      </div>

      {(!refunds || refunds.length === 0) ? (
        <Card>
          <CardBody className="py-12 text-center">
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {dict.refunds?.empty}
            </p>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-4">
          {refunds.map((refund) => (
            <Card key={refund.id}>
              <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center justify-between py-4">
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900 dark:text-white">
                      {(dict as any).refunds?.booking || "Bron"}: #{refund.booking_id}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        refund.status === "completed" || refund.status === "approved"
                          ? "bg-emerald-100 text-emerald-700"
                          : refund.status === "rejected"
                          ? "bg-red-100 text-red-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {refund.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    <span className="font-medium">{dict.refunds?.reason}:</span> {refund.reason}
                  </p>
                </div>
                <div className="flex items-center gap-1 text-xs text-slate-400 shrink-0">
                  <Clock className="h-3 w-3" />
                  {formatDate(refund.created_at)}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
