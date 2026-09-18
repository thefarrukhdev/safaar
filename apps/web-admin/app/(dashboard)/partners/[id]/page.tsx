"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import Tabs from "@/components/ui/Tabs";
import Modal from "@/components/ui/Modal";
import Input from "@/components/ui/Input";
import { useAdminStore } from "@/lib/store";
import { formatDate, formatPrice, cn } from "@/lib/utils";
import { PARTNER_STATUS_MAP, BOOKING_STATUS_MAP } from "@/lib/constants";
import {
  ArrowLeft, Ban, CheckCircle, Pause, Mail, MessageSquare, Trash2,
  Hotel, Bus, Star, CalendarCheck, CreditCard, Pencil, MessageCircle, Home, Bed, Trees, UtensilsCrossed, FileText, PlusCircle, ArrowUpRight, ArrowDownRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PartnerTypeDisplay } from "@/components/ui/PartnerTypeDisplay";
import { AdminApi } from "@/lib/api/admin-api";
import type { AdminHotelBooking, Partner, PartnerLedgerEntry } from "@/types/admin";

export default function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const partnerNotes = useAdminStore((s) => s.partnerNotes);
  const setPartnerNote = useAdminStore((s) => s.setPartnerNote);
  const [partner, setPartner] = useState<Partner | null>(null);
  const [partnerBookings, setPartnerBookings] = useState<AdminHotelBooking[]>([]);
  const [partnerLedger, setPartnerLedger] = useState<PartnerLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [commissionModalOpen, setCommissionModalOpen] = useState(false);
  const [commissionInput, setCommissionInput] = useState("");
  const [noteDraft, setNoteDraft] = useState(partnerNotes[id] ?? "");

  const [adjModalOpen, setAdjModalOpen] = useState(false);
  const [adjForm, setAdjForm] = useState({ amount: "", description: "", type: "adjustment" as "adjustment" | "refund" });
  const [adjSubmitting, setAdjSubmitting] = useState(false);

  const fetchLedger = async () => {
    try {
      const ledger = await AdminApi.getPartnerLedger(id);
      setPartnerLedger(ledger);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    async function loadPartner() {
      const [partnerData, bookings] = await Promise.all([
        AdminApi.getPartner(id),
        AdminApi.getBookings(),
      ]);
      setPartner(partnerData);
      setPartnerBookings(bookings.filter((booking) => booking.partnerId === id).slice(0, 8));
      await fetchLedger();
    }

    loadPartner().finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex justify-center p-12">
        <span className="w-8 h-8 border-4 border-[var(--primary)] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!partner) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="text-lg text-[var(--text-muted)]">Hamkor topilmadi</p>
        <Link href="/partners/list" className="text-sm text-[var(--primary)] hover:underline">
          ← Ro&apos;yxatga qaytish
        </Link>
      </div>
    );
  }

  const handleStatusChange = async (status: "active" | "suspended" | "blocked") => {
    const updated = await AdminApi.updatePartnerStatus(id, status);
    setPartner(updated);
    toast.success("Hamkor holati yangilandi!");
  };

  const handleDelete = async () => {
    if (confirm("Rostdan ham ushbu hamkorni o'chirmoqchimisiz?")) {
      await AdminApi.deletePartner(id);
      toast.success("Hamkor o'chirildi!");
      router.push("/partners/list");
    }
  };

  const handleCommissionSave = async () => {
    const value = parseFloat(commissionInput);
    if (isNaN(value) || value < 0 || value > 100) {
      toast.error("0 dan 100 gacha to'g'ri qiymat kiriting");
      return;
    }
    const updated = await AdminApi.updatePartnerCommission(id, value);
    setPartner(updated);
    toast.success("Komissiya foizi yangilandi!");
    setCommissionModalOpen(false);
  };

  const handleAdjustmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(adjForm.amount);
    if (isNaN(val) || val === 0 || !adjForm.description) {
      toast.error("Barcha maydonlarni to'g'ri to'ldiring");
      return;
    }
    setAdjSubmitting(true);
    try {
      await AdminApi.addPartnerAdjustment(id, { amount: val, description: adjForm.description, type: adjForm.type });
      toast.success("Tuzatish muvaffaqiyatli saqlandi");
      setAdjModalOpen(false);
      setAdjForm({ amount: "", description: "", type: "adjustment" });
      await fetchLedger();
    } catch (e: any) {
      toast.error(e.message || "Xatolik yuz berdi");
    } finally {
      setAdjSubmitting(false);
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto flex flex-col gap-6">
      {/* Back */}
      <Link
        href="/partners/list"
        className="inline-flex items-center gap-2 text-sm text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors w-fit"
      >
        <ArrowLeft size={16} />
        Hamkorlar ro&apos;yxatiga qaytish
      </Link>

      {/* Profile header */}
      <Card padding="lg">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-xl shrink-0"
              style={{
                background: partner.type === "bus"
                  ? "linear-gradient(135deg, #2ECC71, #25A85C)"
                  : partner.type === "restaurant"
                    ? "linear-gradient(135deg, #E67E22, #D35400)"
                    : "linear-gradient(135deg, #1E3A5F, #2B5278)",
              }}
            >
              {partner.type === "bus" ? <Bus size={28} /> :
               partner.type === "hostel" ? <Bed size={28} /> :
               partner.type === "guesthouse" ? <Home size={28} /> :
               partner.type === "dacha" ? <Trees size={28} /> :
               partner.type === "restaurant" ? <UtensilsCrossed size={28} /> :
               <Hotel size={28} />}
            </div>
            <div>
              <h1 className="text-xl font-bold text-[var(--text-primary)]">{partner.companyName}</h1>
              <p className="text-sm text-[var(--text-muted)] mt-0.5 flex items-center gap-1.5">
                {partner.city} · {partner.contactPerson} · <PartnerTypeDisplay type={partner.type} />
              </p>
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge status={partner.status} statusMap={PARTNER_STATUS_MAP} />
                <span className="inline-flex items-center gap-1 text-sm font-medium text-[var(--warning)]">
                  <Star size={14} className="fill-current" /> {partner.rating.toFixed(1)}
                </span>
                <span className="text-xs text-[var(--text-muted)]">ID: {partner.id}</span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {partner.status === "active" ? (
              <>
                <Button variant="secondary" size="sm" icon={<Pause size={14} />} onClick={() => handleStatusChange("suspended")}>To&apos;xtatish</Button>
                <Button variant="danger" size="sm" icon={<Ban size={14} />} onClick={() => handleStatusChange("blocked")}>Bloklash</Button>
              </>
            ) : (
              <Button variant="accent" size="sm" icon={<CheckCircle size={14} />} onClick={() => handleStatusChange("active")}>Faollashtirish</Button>
            )}
            <a href={`mailto:${partner.email}`}>
              <Button variant="secondary" size="sm" icon={<Mail size={14} />}>Email</Button>
            </a>
            <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={handleDelete}>O&apos;chirish</Button>
          </div>
        </div>
      </Card>

      {/* Info cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Telefon", value: partner.phone },
          { label: "Email", value: partner.email },
          {
            label: "Komissiya",
            value: `${partner.commissionPercent}%`,
            highlight: true,
            // 2026-09-14 SAFAAR ADMIN audit: `commissionPercent`
            // (`default_commission_rate`) mehmonxona/hostel/guest house
            // turlari uchun HAQIQIY qo'llanilmaydi — Excel jadvali
            // (hudud+tur+yulduz) HAR DOIM ustun (2026-09-13 tasdiqlangan
            // biznes qoida). Bu yerda oldin bu farq HECH QAYERDA
            // ko'rsatilmagan edi — admin bu raqamni "hamma bron shu
            // foizda" deb noto'g'ri tushunishi mumkin edi.
            note: ["hotel", "hostel", "guesthouse"].includes(partner.type)
              ? "Excel jadvali ustuvor — bu raqam faqat Excel qamrab olmagan holatlar uchun"
              : undefined,
          },
          { label: "Ro'yxat sanasi", value: formatDate(partner.createdAt) },
          { label: "Bank", value: partner.bankName ?? "—" },
        ].map((info) => (
          <Card key={info.label} padding="sm">
            <p className="text-xs text-[var(--text-muted)] mb-1">{info.label}</p>
            <div className="flex items-center gap-2">
              <p className={`text-sm font-semibold ${info.highlight ? "text-[var(--accent)]" : "text-[var(--text-primary)]"}`}>
                {info.value}
              </p>
              {info.highlight && (
                <button
                  onClick={() => {
                    setCommissionInput(partner.commissionPercent.toString());
                    setCommissionModalOpen(true);
                  }}
                  className="text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors cursor-pointer"
                >
                  <Pencil size={12} />
                </button>
              )}
            </div>
            {info.note && (
              <p className="text-[10px] text-[var(--text-muted)] mt-1 leading-tight">{info.note}</p>
            )}
          </Card>
        ))}
      </div>

      {/* Tabs */}
      <Tabs
        tabs={[
          {
            id: "bookings",
            label: "Bronlar",
            icon: <CalendarCheck size={16} />,
            count: partner.totalBookings,
            content: (
              <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-white">
                <table className="w-full text-sm whitespace-nowrap">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-tertiary)]">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Bron ID</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Mijoz</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Sana</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Summa</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-[var(--text-muted)] uppercase">Holat</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-light)]">
                    {partnerBookings.length === 0 && (
                      <tr><td colSpan={5} className="px-4 py-8 text-center text-[var(--text-muted)]">Bronlar mavjud emas</td></tr>
                    )}
                    {partnerBookings.map((b) => (
                      <tr key={b.id} className="hover:bg-[var(--bg-tertiary)] transition-colors">
                        <td className="px-4 py-3 font-mono text-xs text-[var(--text-muted)]">{b.id}</td>
                        <td className="px-4 py-3 font-medium">{b.customerName}</td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">{formatDate(b.createdAt)}</td>
                        <td className="px-4 py-3 font-medium">{formatPrice(b.amount)}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={String(b.status)} statusMap={BOOKING_STATUS_MAP} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ),
          },
          {
            id: "finance",
            label: "Moliya",
            icon: <CreditCard size={16} />,
            content: (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card padding="md">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Umumiy daromad</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">{formatPrice(partner.totalRevenue)}</p>
                </Card>
                <Card padding="md">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Komissiya ({partner.commissionPercent}%)</p>
                  <p className="text-lg font-bold text-[var(--accent)]">
                    {formatPrice(Math.floor(partner.totalRevenue * partner.commissionPercent / 100))}
                  </p>
                </Card>
                <Card padding="md">
                  <p className="text-xs text-[var(--text-muted)] mb-1">Hamkorga to&apos;langan</p>
                  <p className="text-lg font-bold text-[var(--text-primary)]">
                    {formatPrice(Math.floor(partner.totalRevenue * (100 - partner.commissionPercent) / 100))}
                  </p>
                </Card>
              </div>
            ),
          },
          {
            id: "ledger",
            label: "Balans tarixi",
            icon: <FileText size={16} />,
            content: (
              <div className="bg-white rounded-xl border border-[var(--border)] flex flex-col overflow-hidden">
                <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-slate-50/50">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <FileText size={18} className="text-slate-400" /> Tranzaksiyalar (Ledger)
                  </h3>
                  <Button size="sm" icon={<PlusCircle size={14} />} onClick={() => setAdjModalOpen(true)}>
                    Qo'lda tuzatish (Adjustment)
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-[var(--border)] text-slate-500 font-medium">
                      <tr>
                        <th className="px-4 py-3">Sana</th>
                        <th className="px-4 py-3">Turi</th>
                        <th className="px-4 py-3">Tafsilot</th>
                        <th className="px-4 py-3 text-right">Summa</th>
                        <th className="px-4 py-3 text-right">Balans</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {partnerLedger.length === 0 ? (
                        <tr><td colSpan={5} className="px-4 py-12 text-center text-slate-500">Hech qanday tranzaksiya mavjud emas</td></tr>
                      ) : partnerLedger.map((l) => (
                        <tr key={l.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-4 py-3 whitespace-nowrap text-slate-600">{formatDate(l.createdAt)}</td>
                          <td className="px-4 py-3 capitalize text-slate-700 font-medium">
                            {l.type.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-3">
                            <div className="text-slate-700">{l.description}</div>
                            {l.referenceId && <div className="text-xs text-slate-400 font-mono mt-0.5">Ref: {l.referenceId}</div>}
                          </td>
                          <td className="px-4 py-3 text-right font-medium">
                            <span className={cn("inline-flex items-center gap-1", l.amount > 0 ? "text-emerald-600" : "text-red-600")}>
                              {l.amount > 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                              {formatPrice(Math.abs(l.amount))}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-bold text-slate-800">
                            {formatPrice(l.balanceAfter)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ),
          },
          {
            id: "reviews",
            label: "Sharhlar",
            icon: <MessageCircle size={16} />,
            content: (
              <div className="text-center py-12 text-[var(--text-muted)]">
                <MessageCircle size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sharhlar sahifasi keyingi versiyada qo&apos;shiladi</p>
              </div>
            ),
          },
        ]}
      />

      {/* Internal note */}
      <Card padding="md">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-[var(--text-muted)]" />
            <p className="text-sm font-semibold text-[var(--text-primary)]">Ichki izoh</p>
          </div>
          {noteDraft !== (partnerNotes[id] ?? "") && (
            <Button
              size="sm"
              onClick={() => {
                setPartnerNote(id, noteDraft);
                toast.success("Izoh saqlandi");
              }}
            >
              Saqlash
            </Button>
          )}
        </div>
        <textarea
          value={noteDraft}
          onChange={(e) => setNoteDraft(e.target.value)}
          placeholder="Admin izohi yozing (faqat adminlar ko'radi)..."
          className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-[var(--bg-tertiary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none h-20"
        />
      </Card>

      <Modal
        open={commissionModalOpen}
        onClose={() => setCommissionModalOpen(false)}
        title="Komissiya foizini o'zgartirish"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCommissionModalOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleCommissionSave}>
              Saqlash
            </Button>
          </>
        }
      >
        <Input
          type="number"
          label="Komissiya foizi (%)"
          value={commissionInput}
          onChange={(e) => setCommissionInput(e.target.value)}
        />
      </Modal>

      <Modal
        open={adjModalOpen}
        onClose={() => setAdjModalOpen(false)}
        title="Balansga qo'lda tuzatish kiritish"
        footer={
          <div className="flex gap-3 w-full justify-end">
            <Button variant="ghost" onClick={() => setAdjModalOpen(false)}>Bekor qilish</Button>
            <Button onClick={handleAdjustmentSubmit} loading={adjSubmitting}>Saqlash</Button>
          </div>
        }
      >
        <form onSubmit={handleAdjustmentSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Amal turi</label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAdjForm({ ...adjForm, type: "adjustment" })}
                className={cn("flex-1 py-2 text-sm rounded-md border font-medium transition-colors", adjForm.type === "adjustment" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}
              >
                Qo'shish (Credit)
              </button>
              <button
                type="button"
                onClick={() => setAdjForm({ ...adjForm, type: "refund" })}
                className={cn("flex-1 py-2 text-sm rounded-md border font-medium transition-colors", adjForm.type === "refund" ? "bg-red-50 text-red-700 border-red-200" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50")}
              >
                Olib tashlash (Debit)
              </button>
            </div>
          </div>
          <Input
            label="Summa (UZS)"
            type="number"
            placeholder="Misol: 500000"
            value={adjForm.amount}
            onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })}
            required
          />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Sabab / Izoh</label>
            <textarea
              required
              rows={3}
              value={adjForm.description}
              onChange={(e) => setAdjForm({ ...adjForm, description: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-[var(--border)] bg-white focus:outline-none focus:ring-2 focus:ring-[var(--primary)]/20 focus:border-[var(--primary)] transition-all resize-none"
              placeholder="Qo'shimcha to'lov, xizmat haqi..."
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
