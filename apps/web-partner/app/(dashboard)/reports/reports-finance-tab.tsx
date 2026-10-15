"use client";

import { Download, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "../../_components/ui/button";
import { Card, CardBody } from "../../_components/ui/card";
import { formatDate, formatMoney } from "../../_lib/utils/format";
import type { WithdrawalRequest } from "../../_hooks/use-withdrawals";

interface ReportsFinanceTabProps {
  withdrawals: WithdrawalRequest[];
  isLoading: boolean;
  isError: boolean;
  onRefetch: () => void;
  onSubmitWithdrawal: (amount: number, bankAccount: string) => Promise<void>;
  monthRevenue: number;
}

export function ReportsFinanceTab({
  withdrawals,
  isLoading,
  isError,
  onRefetch,
  onSubmitWithdrawal,
  monthRevenue,
}: ReportsFinanceTabProps) {
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBank, setWithdrawBank] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(withdrawAmount);
    if (!amount || amount <= 0 || !withdrawBank.trim()) {
      toast.error("Barcha maydonlarni to'g'ri to'ldiring");
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmitWithdrawal(amount, withdrawBank.trim());
      toast.success("Pul yechish so'rovi yuborildi");
      setWithdrawAmount("");
      setWithdrawBank("");
    } catch {
      toast.error("So'rov yuborishda xatolik yuz berdi");
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentBalance = Math.round(monthRevenue * 0.85); // 15% platform commission

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_360px]">
      {/* 1. Pul yechish tarixi */}
      <div className="flex flex-col gap-6">
        <Card>
          <CardBody className="p-6">
            <div className="flex items-center justify-between mb-4 border-b border-[var(--border)] pb-3">
              <div>
                <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  Pul yechish tarixi
                </h2>
                <p className="mt-0.5 text-xs text-[var(--muted-foreground)]">
                  Hisobingizdan o'tkazilgan va kutilayotgan to'lovlar
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="text-xs font-medium gap-1.5"
                onClick={() => toast.info("Balans hisoboti generatsiya qilinmoqda...")}
              >
                <Download className="h-3.5 w-3.5" />
                <span>Hisobot</span>
              </Button>
            </div>

            {isLoading ? (
              <div className="py-12 text-center text-xs text-[var(--muted-foreground)]">
                Yuklanmoqda...
              </div>
            ) : isError ? (
              <div className="py-12 text-center text-xs text-red-500">
                Pul yechish tarixini yuklashda xatolik yuz berdi.
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onRefetch}
                  className="ml-2 text-brand-600 underline font-medium h-auto p-0 hover:bg-transparent"
                >
                  Qayta urinish
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-[var(--surface-muted)] border-b border-[var(--border)]">
                    <tr>
                      <th className="px-4 py-3 font-semibold text-[var(--muted-foreground)] uppercase">
                        ID
                      </th>
                      <th className="px-4 py-3 font-semibold text-[var(--muted-foreground)] uppercase">
                        Sana
                      </th>
                      <th className="px-4 py-3 font-semibold text-[var(--muted-foreground)] uppercase">
                        Summa
                      </th>
                      <th className="px-4 py-3 font-semibold text-[var(--muted-foreground)] uppercase">
                        Hisob
                      </th>
                      <th className="px-4 py-3 font-semibold text-[var(--muted-foreground)] uppercase">
                        Holat
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {withdrawals.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-12 text-center text-xs text-[var(--muted-foreground)]"
                        >
                          Hozircha pul yechish operatsiyalari amalga oshirilmagan
                        </td>
                      </tr>
                    ) : (
                      withdrawals.map((w) => (
                        <tr
                          key={w.id}
                          className="hover:bg-[var(--surface-muted)] transition-colors"
                        >
                          <td className="px-4 py-3 font-mono text-zinc-500">{w.id}</td>
                          <td className="px-4 py-3">
                            {formatDate(w.requestDate || new Date().toISOString())}
                          </td>
                          <td className="px-4 py-3 font-bold text-zinc-900 dark:text-white">
                            {formatMoney(w.amount)}
                          </td>
                          <td className="px-4 py-3 font-mono text-zinc-600 dark:text-zinc-300">
                            {w.bankAccount}
                          </td>
                          <td className="px-4 py-3">
                            {w.status === "paid" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                                To'landi
                              </span>
                            ) : w.status === "approved" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300">
                                Tasdiqlandi
                              </span>
                            ) : w.status === "pending" ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950/60 dark:text-amber-300">
                                Kutilmoqda
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/60 dark:text-red-300">
                                Rad etilgan
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* 2. Joriy Balans & Pul yechish formasi */}
      <div className="flex flex-col gap-6">
        <Card className="border-emerald-200/60 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900/50">
          <CardBody className="p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Wallet className="h-5 w-5" />
              </div>
              <p className="text-xs font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                Joriy Balans
              </p>
            </div>
            <p className="text-3xl font-bold tracking-tight text-emerald-950 dark:text-emerald-50 mt-1">
              {formatMoney(currentBalance)}
            </p>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-2 leading-relaxed">
              To'liq tasdiqlangan bronlardan tushgan summa (komissiya yechib olinganidan so'ng).
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-6">
            <h3 className="font-bold text-sm text-zinc-900 dark:text-white mb-3">
              Pul yechish so'rovi
            </h3>
            <form onSubmit={handleWithdraw} className="flex flex-col gap-3.5">
              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Summa (UZS)
                </label>
                <input
                  type="number"
                  required
                  min={50000}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  placeholder="Masalan: 5000000"
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                  Hisob raqam / Karta raqami
                </label>
                <input
                  type="text"
                  required
                  value={withdrawBank}
                  onChange={(e) => setWithdrawBank(e.target.value)}
                  placeholder="20208... yoki 8600..."
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 font-mono"
                />
              </div>

              <Button
                type="submit"
                loading={isSubmitting}
                disabled={isSubmitting}
                className="mt-2 w-full"
              >
                So'rov yuborish
              </Button>

              <p className="text-[11px] text-[var(--muted-foreground)] text-center leading-relaxed">
                Pul yechish jarayoni 1-3 ish kunigacha vaqt olishi mumkin.
              </p>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
