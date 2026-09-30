"use client";

import Card from "@/components/ui/Card";
import { Download, Building2, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";
import { AdminApi } from "@/lib/api/admin-api";
import type { PartnerBookingReport } from "@/types/admin";
import { toast } from "sonner";

export default function PartnerReportsPage() {
  const [reports, setReports] = useState<PartnerBookingReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    AdminApi.getPartnerReports()
      .then((res) => {
        if (!cancelled) {
          setReports(res.partners);
        }
      })
      .catch(() => {
        if (!cancelled) {
          toast.error("Hisobotlarni yuklab bo'lmadi.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="flex flex-col gap-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Hamkor hisobotlari</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Hamkorlar tomonidan yuborilgan batafsil to'lov va bron hisobotlari (Online vs Joyida to'lov)
          </p>
        </div>
        <button className="flex items-center gap-2 bg-[var(--primary)] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[var(--primary-light)] transition-colors">
          <Download size={16} /> Barchasini yuklab olish
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <Building2 size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">Kelib tushgan hisobotlar</p>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">{reports.length} ta</h3>
            </div>
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-secondary)]">Tasdiqlangan</p>
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">{reports.length} ta</h3>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-[var(--bg-secondary)] border-b border-[var(--border)]">
              <tr>
                <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">Hisobot ID</th>
                <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">Hamkor (Turi)</th>
                <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">Yuborilgan sana</th>
                <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">Jami bronlar</th>
                <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">Onlayn to'lov</th>
                <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">Joyida to'lov</th>
                <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">Tushum</th>
                <th className="px-4 py-3 font-medium text-[var(--text-secondary)]">Holat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-secondary)]">Yuklanmoqda...</td>
                </tr>
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-[var(--text-secondary)]">Hisobotlar yo'q</td>
                </tr>
              ) : reports.map((report, i) => (
                <tr key={report.organizationId + i} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="px-4 py-3 font-mono text-[var(--text-secondary)] text-xs">{report.organizationId}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-primary)]">{report.partnerName}</div>
                    <div className="text-xs text-[var(--text-muted)] uppercase">{report.domain}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">Joriy davr</td>
                  <td className="px-4 py-3 font-medium">{report.totalBookings}</td>
                  <td className="px-4 py-3 text-emerald-600 font-medium">{report.onlineCount}</td>
                  <td className="px-4 py-3 text-amber-600 font-medium">{report.onsiteCount}</td>
                  <td className="px-4 py-3 font-bold text-[var(--text-primary)]">
                    {new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(report.grossAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Hisoblangan
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
