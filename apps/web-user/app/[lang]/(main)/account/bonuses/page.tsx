import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
 const { lang } = await params;
 if (!isLocale(lang)) return {};
 const dict = await getDictionary(lang as Locale, "account");
 return { title: dict.nav?.bonuses, robots: { index: false, follow: false } };
}
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/dictionaries";
import { getSession } from "@/lib/auth/session";
import { api } from "@/lib/api";
import { formatSum } from "@/lib/money";
import { Card, CardBody } from "@/components/ui/Card";
import { Coins, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import type { BonusView } from "@/types/view";

export default async function AccountBonusesPage({
 params,
}: {
 params: Promise<{ lang: string }>;
}) {
 const { lang } = await params;
 if (!isLocale(lang)) notFound();
 const locale = lang as Locale;

 // SENIOR OPTIMIZATION: Parallelize session & dictionary loading
 const [session, dict] = await Promise.all([
 getSession(),
 getDictionary(locale, "account"),
 ]);

 if (!session) {
 redirect(
 `/${locale}/login?next=${encodeURIComponent(`/${locale}/account/bonuses`)}`,
 );
 }

 const bonuses: BonusView = await api.users.getBonuses({ token: session.accessToken });

 const balanceSum = bonuses.balanceSum;
 const entries = bonuses.entries;

 function formatDate(value: string): string {
 const ts = Date.parse(value);
 return Number.isFinite(ts)
 ? new Date(ts).toLocaleDateString("uz-UZ")
 : value;
 }

 return (
 <div className="flex flex-col gap-6">
 {/* Ambient Glow Balance Card */}
 <div className="relative overflow-hidden rounded-xl bg-linear-to-r from-blue-900 via-blue-800 to-slate-900 p-6 sm:p-8 text-white border border-slate-200">
 <div className="relative z-10 flex flex-col gap-2">
 <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-300">
 <Coins className="h-4 w-4" /> {dict.bonuses.balance}
 </span>
 <span className="text-3xl font-extrabold tracking-tight sm:text-4xl text-white">
 {formatSum(balanceSum)}
 </span>
 <p className="mt-1 text-xs text-blue-200/80">
 {(dict as any).bonuses?.disclaimer || "*Safarlar va bron qilishlar uchun to'plangan bonus balingiz."}
 </p>
 </div>
 </div>

 {entries.length === 0 ? (
 <Card>
 <CardBody className="py-12 sm:py-16 text-center">
 <p className="text-sm font-medium text-slate-500 ">{dict.bonuses.empty}</p>
 </CardBody>
 </Card>
 ) : (
 <Card>
 <CardBody className="flex flex-col gap-4">
 <h2 className="text-base font-bold text-slate-900 ">{dict.bonuses.history}</h2>
 <ul className="flex flex-col divide-y divide-slate-100 ">
 {entries.map((entry) => {
 const positive = entry.amountSum >= 0;
 return (
 <li
 key={entry.id}
 className="flex items-center justify-between gap-4 py-3.5"
 >
 <div className="flex items-center gap-3">
 <span
 className={`flex h-9 w-9 items-center justify-center rounded-full ${
 positive
 ? "bg-emerald-100 text-emerald-700 "
 : "bg-red-100 text-red-700 "
 }`}
 >
 {positive ? (
 <ArrowDownLeft className="h-4 w-4" />
 ) : (
 <ArrowUpRight className="h-4 w-4" />
 )}
 </span>
 <div className="flex flex-col">
 <span className="text-sm font-semibold text-slate-900 ">
 {entry.reason}
 </span>
 <span className="text-xs text-slate-500 ">
 {formatDate(entry.createdAt)}
 </span>
 </div>
 </div>

 <span
 className={`text-sm font-bold tabular-nums ${
 positive
 ? "text-emerald-600 "
 : "text-red-600 "
 }`}
 >
 {positive ? "+" : "−"}
 {formatSum(Math.abs(entry.amountSum))}
 </span>
 </li>
 );
 })}
 </ul>
 </CardBody>
 </Card>
 )}
 </div>
 );
}
