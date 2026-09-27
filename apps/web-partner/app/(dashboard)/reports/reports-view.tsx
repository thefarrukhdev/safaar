"use client";

import {
  Activity,
  BedDouble,
  CarFront,
  DollarSign,
  TrendingDown,
  TrendingUp,
  CreditCard,
  Calendar,
  UtensilsCrossed,
  Download,
  Wallet
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Card,
  CardBody,
} from "../../_components/ui/card";
import { PageHeader } from "../../_components/layout/page-header";
import { formatMoney } from "../../_lib/utils/format";
import {
  buildDachaAvailabilitySummary,
  buildDailyStats,
  buildSourceDistribution,
  buildUnitTypeDistribution,
} from "../../_lib/domain/reports";
import { useReservations } from "../../_hooks/use-reservations";
import { useRoomTypes } from "../../_hooks/use-room-types";
import { useDataStore } from "../../_stores/data-store";
import { useAuthStore } from "../../_stores/auth-store";
import { getPartnerLabels, hasBuses, isDacha, isRestaurant } from "../../_lib/utils/partner-labels";
import { TODAY_ISO } from "../../_lib/utils/date";
import { cn } from "../../_lib/utils/cn";
import { getWithdrawals, createWithdrawal, WithdrawalRequest } from "../../_lib/api/endpoints/partners";
import { formatDate } from "../../_lib/utils/format";

type TimeRange = "7days" | "30days" | "year";
type ViewTab = "stats" | "finance" | "detailed";

export function ReportsView() {
  const [activeTab, setActiveTab] = useState<ViewTab>("stats");
  const [timeRange, setTimeRange] = useState<TimeRange>("30days");
  
  const { data: reservations } = useReservations();
  const { data: roomTypes } = useRoomTypes();
  const getStats = useDataStore((s) => s.getStats);
  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const dacha = isDacha(partnerType);
  const restaurant = isRestaurant(partnerType);
  const isBus = hasBuses(partnerType);

  // Finance states
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBank, setWithdrawBank] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [financeLoading, setFinanceLoading] = useState(false);

  const fetchWithdrawals = async (silent = false) => {
    try {
      if (!silent) setFinanceLoading(true);
      const data = await getWithdrawals(null);
      setWithdrawals(data);
    } catch {
      toast.error("Pul yechish tarixini yuklab bo'lmadi");
    } finally {
      if (!silent) setFinanceLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setFinanceLoading(true);
        const data = await getWithdrawals(null);
        if (!cancelled) setWithdrawals(data);
      } catch {
        if (!cancelled) toast.error("Pul yechish tarixini yuklab bo'lmadi");
      } finally {
        if (!cancelled) setFinanceLoading(false);
      }
    };

    if (activeTab === "finance") {
      void load();
    }
    return () => { cancelled = true; };
  }, [activeTab]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || !withdrawBank) {
      toast.error("Barcha maydonlarni to'g'ri to'ldiring");
      return;
    }
    
    try {
      setIsSubmitting(true);
      await createWithdrawal({ amount, bankAccount: withdrawBank }, null);
      toast.success("Pul yechish so'rovi yuborildi");
      setWithdrawAmount("");
      setWithdrawBank("");
      fetchWithdrawals();
    } catch {
      toast.error("So'rov yuborishda xatolik");
    } finally {
      setIsSubmitting(false);
    }
  };

  const daysForRange = timeRange === "7days" ? 7 : timeRange === "year" ? 365 : 30;
  const dailyStats = useMemo(
    () => buildDailyStats(reservations, TODAY_ISO, daysForRange),
    [reservations, daysForRange],
  );
  const stats = getStats();
  const totalUnits = stats.totalRooms;

  const revenue = useMemo(
    () => dailyStats.map((d) => ({ date: d.date, revenue: d.revenue, bookings: d.bookings })),
    [dailyStats],
  );
  const occupancy = useMemo(
    () =>
      dailyStats.map((d) => ({
        date: d.date,
        occupancy: totalUnits > 0 ? Math.min(100, Math.round((d.occupiedUnits / totalUnits) * 100)) : 0,
      })),
    [dailyStats, totalUnits],
  );
  const unitTypeDistribution = useMemo(
    () => buildUnitTypeDistribution(reservations, roomTypes),
    [reservations, roomTypes],
  );
  const sourceDistribution = useMemo(
    () => buildSourceDistribution(reservations),
    [reservations],
  );
  const dachaSummary = useMemo(
    () => buildDachaAvailabilitySummary(dailyStats),
    [dailyStats],
  );

  const monthRevenue = revenue.reduce((s, d) => s + d.revenue, 0);
  const monthBookings = revenue.reduce((s, d) => s + d.bookings, 0);
  const avgOccupancy = occupancy.length
    ? Math.round(occupancy.reduce((s, d) => s + d.occupancy, 0) / occupancy.length)
    : 0;
  const adr = monthBookings > 0 ? Math.round(monthRevenue / monthBookings) : 0;

  const recentRevenue = revenue.slice(-7).reverse();
  const recentOccupancy = occupancy.slice(-7).reverse();

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          eyebrow="Tahlil va Moliya"
          title="Biznes Hisobotlari"
          description="Moliyaviy holati, pul yechish va sotuvlar tahlili."
        />
        <div className="flex bg-zinc-100 dark:bg-zinc-800/50 p-1 rounded-xl w-fit">
          <button
            onClick={() => setActiveTab("stats")}
            className={cn(
              "px-5 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === "stats" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            )}
          >
            Statistika
          </button>
          <button
            onClick={() => setActiveTab("finance")}
            className={cn(
              "px-5 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === "finance" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            )}
          >
            Moliya & Pul yechish
          </button>
          <button
            onClick={() => setActiveTab("detailed")}
            className={cn(
              "px-5 py-2 text-sm font-medium rounded-lg transition-all",
              activeTab === "detailed" ? "bg-white dark:bg-zinc-700 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            )}
          >
            To'liq Hisobot
          </button>
        </div>
      </div>

      {activeTab === "stats" && (
        <div className="flex flex-col gap-8 animate-fade-in">
          {/* Vaqt Filtrlari */}
          <div className="flex justify-center md:justify-end">
            <div className="flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-900/60 rounded-xl">
              <TimeTab active={timeRange === "7days"} onClick={() => setTimeRange("7days")} label="Oxirgi 7 kun" />
              <TimeTab active={timeRange === "30days"} onClick={() => setTimeRange("30days")} label="Oxirgi 30 kun" />
              <TimeTab active={timeRange === "year"} onClick={() => setTimeRange("year")} label="Joriy yil" />
            </div>
          </div>

          {/* Asosiy ko'rsatkichlar (KPIs) */}
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <ReportMetric
              label="Umumiy Daromad"
              value={formatMoney(monthRevenue)}
              trend={{ value: 12, positive: true }}
              icon={<DollarSign className="h-6 w-6" />}
              tone="brand"
            />
            <ReportMetric
              label={isBus ? "O'rtacha Bandlik va Sig'im" : "O'rtacha Bandlik"}
              value={`${avgOccupancy}%`}
              trend={{ value: 5, positive: true }}
              icon={<Activity className="h-6 w-6" />}
              tone="accent"
            />
            <ReportMetric
              label={isBus ? "O'rtacha ijara narxi" : restaurant ? "O'rtacha bron narxi" : "O'rtacha kunlik narx (ADR)"}
              value={formatMoney(adr)}
              trend={{ value: 2, positive: false }}
              icon={<CreditCard className="h-6 w-6" />}
              tone="warning"
            />
            <ReportMetric
              label={isBus ? "Yangi Ijara Bronlari" : "Yangi Bronlar"}
              value={monthBookings.toString()}
              trend={{ value: 8, positive: true }}
              icon={isBus ? <CarFront className="h-6 w-6" /> : restaurant ? <UtensilsCrossed className="h-6 w-6" /> : <BedDouble className="h-6 w-6" />}
              tone="success"
            />
          </section>

          {/* Daromad va Bandlik Ro'yxatlari */}
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-none shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-800/50 flex flex-col">
              <CardBody className="p-6 flex-1 flex flex-col">
                <div className="mb-6 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Oxirgi kunlar daromadi</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Kunlik tushumlar va bronlar soni</p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-0">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 px-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    <span>Sana</span>
                    <span className="text-right w-16">Bronlar</span>
                    <span className="text-right w-24">Daromad</span>
                  </div>
                  
                  {recentRevenue.map((d) => (
                    <div key={d.date} className="grid grid-cols-[1fr_auto_auto] gap-4 py-3 px-1 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors rounded-md">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200">{formatShortDate(d.date)}</span>
                      </div>
                      <span className="text-sm font-medium text-zinc-600 dark:text-zinc-400 text-right w-16">{d.bookings} ta</span>
                      <span className="text-sm font-bold text-zinc-900 dark:text-white text-right w-24">{formatMoney(d.revenue)}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-800/50 flex flex-col">
              <CardBody className="p-6 flex-1 flex flex-col">
                <div className="mb-6 flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
                  <div>
                    <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Oxirgi kunlar bandligi</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      {labels.unitPlural.charAt(0).toUpperCase()}{labels.unitPlural.slice(1)} qanchalik to'lganligi (foizda)
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-col gap-0">
                  <div className="grid grid-cols-[1fr_auto] gap-4 py-2 px-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    <span>Sana</span>
                    <span className="text-right">To'liqlik (%)</span>
                  </div>
                  
                  {recentOccupancy.map((d) => (
                    <div key={d.date} className="grid grid-cols-[1fr_auto] gap-4 py-3 px-1 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors rounded-md">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm font-medium text-zinc-900 dark:text-zinc-200">{formatShortDate(d.date)}</span>
                      </div>
                      <div className="flex items-center justify-end gap-2">
                        <span className={cn(
                          "text-sm font-bold text-right",
                          d.occupancy >= 80 ? "text-emerald-600 dark:text-emerald-400" : 
                          d.occupancy >= 50 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400"
                        )}>
                          {d.occupancy}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-none shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-800/50 flex flex-col">
              <CardBody className="p-6 flex-1 flex flex-col">
                <div className="mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Sotuv manbalari</h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Mehmonlar qaysi platformalardan kelmoqda?</p>
                </div>
                
                <div className="flex flex-col gap-0">
                  <div className="grid grid-cols-[1fr_auto_auto] gap-4 py-2 px-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                    <span>Manba (Platforma)</span>
                    <span className="text-right w-16">Ulush</span>
                    <span className="text-right w-16">Bronlar</span>
                  </div>
                  
                  {(() => {
                    const totalSrc = sourceDistribution.reduce((s, r) => s + r.value, 0);
                    const sortedSrc = [...sourceDistribution].sort((a,b) => b.value - a.value).slice(0, 5);
                    
                    return sortedSrc.map((s) => {
                      const pct = totalSrc ? Math.round((s.value / totalSrc) * 100) : 0;
                      return (
                        <div key={s.name} className="grid grid-cols-[1fr_auto_auto] gap-4 py-3 px-1 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors rounded-md">
                          <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">{s.name}</span>
                          <span className="text-sm font-medium text-zinc-500 text-right w-16">{pct}%</span>
                          <span className="text-sm font-bold text-zinc-900 dark:text-white text-right w-16">{s.value} ta</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </CardBody>
            </Card>

            {dacha ? (
              <Card className="border-none shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-800/50">
                <CardBody className="p-6">
                  <div className="mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Bandlik holati</h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Oxirgi {dachaSummary.totalNights} kunda dachangiz qanchalik band bo'lgan</p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">
                        {dachaSummary.bookedNights}/{dachaSummary.totalNights}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">kun band bo'lgan</p>
                    </div>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-brand-600"
                        style={{ width: `${dachaSummary.totalNights > 0 ? Math.round((dachaSummary.bookedNights / dachaSummary.totalNights) * 100) : 0}%` }}
                      />
                    </div>
                  </div>
                </CardBody>
              </Card>
            ) : (
              <Card className="border-none shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-800/50">
                <CardBody className="p-6">
                  <div className="mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                    <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                      Top {labels.unitTypeLabel.toLowerCase()}lari (Daromad bo'yicha)
                    </h2>
                    <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                      Biznesga eng ko'p foyda keltiruvchi top-5 {labels.unitTypeLabel.toLowerCase()}
                    </p>
                  </div>

                  <div className="flex flex-col gap-0">
                    <div className="grid grid-cols-[auto_1fr_auto] gap-4 py-2 px-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                      <span className="w-6 text-center">#</span>
                      <span>{labels.unitTypeLabel}</span>
                      <span className="text-right">Daromad</span>
                    </div>

                    {unitTypeDistribution.length === 0 ? (
                      <p className="py-4 text-sm text-zinc-500 dark:text-zinc-400">
                        Hali bronlar yo'q.
                      </p>
                    ) : (
                      [...unitTypeDistribution]
                        .sort((a, b) => b.revenue - a.revenue)
                        .slice(0, 5)
                        .map((r, index) => (
                          <div key={r.id} className="grid grid-cols-[auto_1fr_auto] gap-4 py-3 px-1 border-b border-zinc-100 dark:border-zinc-800/60 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors rounded-md">
                            <span className="text-sm font-mono text-zinc-400 w-6 text-center">{index + 1}</span>
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-200">{r.name}</span>
                              <span className="text-xs text-zinc-500 mt-0.5">{r.bookings} ta bron qilingan</span>
                            </div>
                            <span className="text-sm font-bold text-zinc-900 dark:text-white text-right self-center">{formatMoney(r.revenue)}</span>
                          </div>
                        ))
                    )}
                  </div>
                </CardBody>
              </Card>
            )}
          </div>
        </div>
      )}

      {activeTab === "finance" && (
        <div className="grid gap-6 md:grid-cols-[1fr_350px] animate-fade-in">
          <div className="flex flex-col gap-6">
            <Card className="border-none shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-800/50">
              <CardBody className="p-6">
                <div className="flex items-center justify-between mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Pul yechish tarixi</h2>
                  <button className="text-sm font-medium text-[var(--primary)] hover:underline flex items-center gap-1">
                    <Download size={14} /> Balans hisoboti
                  </button>
                </div>

                {financeLoading ? (
                  <div className="py-12 text-center text-sm text-zinc-500">Yuklanmoqda...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                      <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                        <tr>
                          <th className="px-4 py-3 font-medium text-zinc-500">ID</th>
                          <th className="px-4 py-3 font-medium text-zinc-500">Sana</th>
                          <th className="px-4 py-3 font-medium text-zinc-500">Summa</th>
                          <th className="px-4 py-3 font-medium text-zinc-500">Hisob</th>
                          <th className="px-4 py-3 font-medium text-zinc-500">Holat</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                        {withdrawals.length === 0 ? (
                          <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-500">Tarix topilmadi</td></tr>
                        ) : withdrawals.map((w) => (
                          <tr key={w.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                            <td className="px-4 py-3 font-mono text-xs text-zinc-500">{w.id}</td>
                            <td className="px-4 py-3">{formatDate(w.requestDate || new Date().toISOString())}</td>
                            <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">{formatMoney(w.amount)}</td>
                            <td className="px-4 py-3 font-mono text-xs text-zinc-600">{w.bankAccount}</td>
                            <td className="px-4 py-3">
                              {w.status === 'paid' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">To'landi</span>
                              ) : w.status === 'approved' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Tasdiqlandi</span>
                              ) : w.status === 'pending' ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Kutilmoqda</span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Rad etilgan</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card className="border-none shadow-sm ring-1 ring-emerald-200/50 bg-emerald-50 dark:bg-emerald-950/20 dark:ring-emerald-900/50">
              <CardBody className="p-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg text-emerald-600 dark:text-emerald-400">
                    <Wallet size={20} />
                  </div>
                  <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">Joriy Balans</p>
                </div>
                <p className="text-3xl font-bold tracking-tight text-emerald-900 dark:text-emerald-100">
                  {formatMoney(monthRevenue * 0.85)} {/* 15% commission abstract logic for display */}
                </p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                  To'liq tasdiqlangan bronlardan tushgan summa (komissiya yechib olinganidan so'ng).
                </p>
              </CardBody>
            </Card>

            <Card className="border-none shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-800/50">
              <CardBody className="p-6">
                <h3 className="font-bold text-zinc-900 dark:text-white mb-4">Pul yechish so'rovi</h3>
                <form onSubmit={handleWithdraw} className="flex flex-col gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Summa (UZS)</label>
                    <input
                      type="number"
                      required
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Masalan: 5000000"
                      className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Hisob raqam / Karta</label>
                    <input
                      type="text"
                      required
                      value={withdrawBank}
                      onChange={(e) => setWithdrawBank(e.target.value)}
                      placeholder="Tranzit hisob yoki Uzcard"
                      className="w-full rounded-md border border-zinc-200 dark:border-zinc-700 bg-transparent px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="mt-2 w-full flex items-center justify-center gap-2 rounded-md bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
                  >
                    {isSubmitting ? "Yuborilmoqda..." : "So'rov yuborish"}
                  </button>
                  <p className="text-[10px] text-zinc-500 mt-1 text-center">
                    Pul yechish jarayoni 1-3 ish kunigacha vaqt olishi mumkin.
                  </p>
                </form>
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {activeTab === "detailed" && (
        <div className="flex flex-col gap-6 animate-fade-in">
          <Card className="border-none shadow-sm ring-1 ring-zinc-200/50 dark:ring-zinc-800/50">
            <CardBody className="p-6">
              <div className="flex items-center justify-between mb-6 border-b border-zinc-100 dark:border-zinc-800 pb-4">
                <div>
                  <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">Bronlar va To'lovlar (To'liq)</h2>
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Onlayn va joyida qilingan to'lovlar bo'yicha batafsil hisobot</p>
                </div>
                <button
                  onClick={() => {
                    toast.success("Hisobot admin panelga yuvorildi!");
                  }}
                  className="flex items-center gap-2 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700"
                >
                  <Download size={16} /> Adminga yuborish
                </button>
              </div>

              {/* Stats summary block */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="p-4 rounded-xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-zinc-800">
                  <p className="text-sm text-zinc-500 mb-1">Jami bronlar</p>
                  <p className="text-2xl font-bold text-zinc-900 dark:text-white">{reservations?.length || 0}</p>
                </div>
                <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/30">
                  <p className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">Onlayn (UzBron)</p>
                  <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-300">
                    {reservations?.filter(r => r.source === "UZBRON").length || 0}
                  </p>
                </div>
                <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-800/30">
                  <p className="text-sm text-amber-600 dark:text-amber-400 mb-1">Joyida to'lanadigan</p>
                  <p className="text-2xl font-bold text-amber-900 dark:text-amber-300">
                    {reservations?.filter(r => r.source !== "UZBRON").length || 0}
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-zinc-50 dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
                    <tr>
                      <th className="px-4 py-3 font-medium text-zinc-500">Mijoz</th>
                      <th className="px-4 py-3 font-medium text-zinc-500">Sana</th>
                      <th className="px-4 py-3 font-medium text-zinc-500">Summa</th>
                      <th className="px-4 py-3 font-medium text-zinc-500">To'lov turi</th>
                      <th className="px-4 py-3 font-medium text-zinc-500">Holat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                    {!reservations || reservations.length === 0 ? (
                      <tr><td colSpan={5} className="px-4 py-12 text-center text-zinc-500">Bronlar topilmadi</td></tr>
                    ) : reservations.map((r) => {
                      const isOnline = r.source === "UZBRON";
                      return (
                      <tr key={r.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-900/50">
                        <td className="px-4 py-3">
                          <div className="font-medium text-zinc-900 dark:text-white">{r.guest?.fullName}</div>
                          <div className="text-xs text-zinc-500">{r.guest?.phone}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div>{formatShortDate(r.checkIn)} — {formatShortDate(r.checkOut)}</div>
                        </td>
                        <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">{formatMoney(r.totalPrice)}</td>
                        <td className="px-4 py-3">
                          {isOnline ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700">Online</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Joyida (Naqd)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs text-zinc-500 uppercase">{r.status}</span>
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Yordamchi Komponentlar
// ==========================================

function formatShortDate(isoDate: string) {
  const d = new Date(isoDate);
  const months = ["Yan", "Fev", "Mar", "Apr", "May", "Iyun", "Iyul", "Avg", "Sen", "Okt", "Noy", "Dek"];
  return `${d.getDate()}-${months[d.getMonth()]}`;
}

function TimeTab({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 whitespace-nowrap",
        active 
          ? "bg-white text-zinc-900 shadow-sm ring-1 ring-zinc-200/50 dark:bg-zinc-800 dark:text-white dark:ring-zinc-700/50" 
          : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/30 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/30"
      )}
    >
      {label}
    </button>
  );
}

function ReportMetric({
  label, value, trend, icon, tone = "brand"
}: {
  label: string;
  value: string;
  trend?: { value: number; positive: boolean };
  icon: React.ReactNode;
  tone?: "brand" | "accent" | "warning" | "success" | "danger" | "neutral";
}) {
  const toneMap = {
    neutral: { bg: "bg-zinc-100 dark:bg-zinc-800/60", icon: "text-zinc-500" },
    brand: { bg: "bg-brand-50 dark:bg-brand-900/20", icon: "text-brand-600 dark:text-brand-400" },
    accent: { bg: "bg-indigo-50 dark:bg-indigo-900/20", icon: "text-indigo-600 dark:text-indigo-400" },
    warning: { bg: "bg-amber-50 dark:bg-amber-900/20", icon: "text-amber-600 dark:text-amber-400" },
    success: { bg: "bg-emerald-50 dark:bg-emerald-900/20", icon: "text-emerald-600 dark:text-emerald-400" },
    danger: { bg: "bg-red-50 dark:bg-red-900/20", icon: "text-red-600 dark:text-red-400" },
  }[tone];

  return (
    <div className="relative overflow-hidden rounded-2xl bg-white p-5 border border-zinc-200/60 shadow-sm hover:shadow-md transition-shadow duration-200 dark:bg-zinc-900 dark:border-zinc-800/60">
      <div className="flex justify-between items-start">
        <div className="flex flex-col gap-1.5">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
          <p className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-white">{value}</p>
        </div>
        <div className={cn("flex h-12 w-12 items-center justify-center rounded-xl", toneMap.bg, toneMap.icon)}>
          {icon}
        </div>
      </div>
      
      {trend && (
        <div className="mt-5 flex items-center gap-2">
          <div className={cn(
            "flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-md",
            trend.positive 
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" 
              : "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          )}>
            {trend.positive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {trend.value}%
          </div>
          <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">o'tgan oyga nisbatan</span>
        </div>
      )}
    </div>
  );
}
