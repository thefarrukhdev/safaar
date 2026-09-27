"use client";

import Card from "@/components/ui/Card";
import { Download, Building2, CheckCircle2 } from "lucide-react";

export default function PartnerReportsPage() {
  // Mock data for the frontend only as backend doesn't support this yet.
  const mockReports = [
    {
      id: "REP-001",
      partnerName: "Hyatt Regency Tashkent",
      type: "Mehmonxona",
      date: "2026-09-26",
      totalBookings: 145,
      onlinePaid: 120,
      onSitePaid: 25,
      totalRevenue: 245000000,
      status: "Qabul qilingan",
    },
    {
      id: "REP-002",
      partnerName: "Chorvoq Oromgohi (Piramidalar)",
      type: "Dacha",
      date: "2026-09-25",
      totalBookings: 42,
      onlinePaid: 30,
      onSitePaid: 12,
      totalRevenue: 85000000,
      status: "Qabul qilingan",
    },
    {
      id: "REP-003",
      partnerName: "Afrosiyob Tezyurar Poezdi",
      type: "Transport",
      date: "2026-09-24",
      totalBookings: 320,
      onlinePaid: 320,
      onSitePaid: 0,
      totalRevenue: 64000000,
      status: "Tekshirilmoqda",
    }
  ];

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
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">156 ta</h3>
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
              <h3 className="text-2xl font-bold text-[var(--text-primary)]">142 ta</h3>
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
              {mockReports.map((report) => (
                <tr key={report.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                  <td className="px-4 py-3 font-mono text-[var(--text-secondary)]">{report.id}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-[var(--text-primary)]">{report.partnerName}</div>
                    <div className="text-xs text-[var(--text-muted)]">{report.type}</div>
                  </td>
                  <td className="px-4 py-3 text-[var(--text-secondary)]">{report.date}</td>
                  <td className="px-4 py-3 font-medium">{report.totalBookings}</td>
                  <td className="px-4 py-3 text-emerald-600 font-medium">{report.onlinePaid}</td>
                  <td className="px-4 py-3 text-amber-600 font-medium">{report.onSitePaid}</td>
                  <td className="px-4 py-3 font-bold text-[var(--text-primary)]">
                    {new Intl.NumberFormat('uz-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(report.totalRevenue)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      report.status === "Qabul qilingan" 
                        ? "bg-emerald-100 text-emerald-800" 
                        : "bg-blue-100 text-blue-800"
                    }`}>
                      {report.status}
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
