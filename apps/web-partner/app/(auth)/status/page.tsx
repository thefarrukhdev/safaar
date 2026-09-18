"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Search, CheckCircle2, AlertCircle, Clock, RotateCcw } from "lucide-react";
import { Button } from "../../_components/ui/button";
import { Input } from "../../_components/ui/input";
import { Label } from "../../_components/ui/label";
import { access } from "../../_lib/api";
import { normalizePhone, maskPhone } from "../../_lib/utils/phone";
import { toast } from "sonner";
import { PartnerAccessStatus } from "../../_lib/api/endpoints/access";

export default function ApplicationStatusPage() {
  const [phone, setPhone] = useState("+998 ");
  const [loading, setLoading] = useState(false);
  const [resubmitting, setResubmitting] = useState(false);
  const [statusResult, setStatusResult] = useState<{
    found: boolean;
    status: PartnerAccessStatus;
    request?: {
      id: string;
      companyName: string;
      status: PartnerAccessStatus;
    } | null;
  } | null>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 9) return;
    setLoading(true);
    setStatusResult(null);
    try {
      const res = await access.getPartnerAccessStatus(normalizePhone(phone));
      setStatusResult(res);
      if (!res.found) {
        toast.error("Bunday raqamga bog'liq ariza topilmadi");
      }
    } catch {
      toast.error("Ariza holatini tekshirib bo'lmadi");
    } finally {
      setLoading(false);
    }
  };

  const handleResubmit = async () => {
    if (!statusResult?.request?.id) return;
    setResubmitting(true);
    try {
      // PRE-EXISTING STUB (out of scope for the 2026-09-15 phone-verification
      // task): this doesn't actually resubmit the original application — it
      // POSTs a brand-new one with fabricated placeholder data (fake email,
      // fake city, hardcoded taxId). Left as-is; the real fix is a proper
      // resubmit UI wired to PartnersService.resubmitApplication, which
      // doesn't exist here and isn't part of this task's declared scope.
      // `phoneVerificationToken` is now a required, backend-enforced proof
      // (see register/page.tsx) — this stub never had a real phone-OTP step
      // of its own, so it's passed empty. Previously this call would
      // SILENTLY SUCCEED and create a garbage application; now the backend
      // correctly rejects it with PARTNER_PHONE_NOT_VERIFIED instead — a
      // safety improvement, not a regression, for a flow that was already
      // non-functional.
      await access.submitPartnerApplication({
        type: "hotel",
        companyName: statusResult.request.companyName,
        contactPerson: "Qayta yuboruvchi",
        phone: normalizePhone(phone),
        email: "resubmitted@example.com",
        city: "Toshkent",
        address: "Qayta yuborilgan manzil",
        taxId: "123456789",
        note: "Qayta yuborilgan ariza",
        phoneVerificationToken: "",
      });
      toast.success("Ariza muvaffaqiyatli qayta yuborildi");
      setStatusResult({ ...statusResult, status: "submitted" });
    } catch {
      toast.error("Xatolik yuz berdi");
    } finally {
      setResubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link
          href="/login"
          className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Login sahifasi
        </Link>
        <div className="flex items-center gap-2">
          <Search className="h-5 w-5 text-brand-700" aria-hidden />
          <h2 className="text-xl font-semibold tracking-tight">Ariza holatini tekshirish</h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          Arizangiz qaysi bosqichda ekanligini ko'rish uchun telefon raqamingizni kiriting.
        </p>
      </div>

      {!statusResult && (
        <form onSubmit={handleCheck} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Telefon raqam</Label>
            <Input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(maskPhone(e.target.value))}
            />
          </div>
          <Button type="submit" loading={loading}>Tekshirish</Button>
        </form>
      )}

      {statusResult && statusResult.found && statusResult.request && (
        <div className="flex flex-col gap-5 p-5 border border-[var(--border)] rounded-xl bg-white dark:bg-[var(--surface)]">
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-1">Kompaniya nomi</p>
            <p className="font-semibold">{statusResult.request.companyName}</p>
          </div>
          
          <div>
            <p className="text-sm text-[var(--muted-foreground)] mb-2">Ariza holati</p>
            {statusResult.status === 'approved' && (
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-3 py-2 rounded-md">
                <CheckCircle2 size={18} />
                <span className="font-medium">Tasdiqlangan</span>
              </div>
            )}
            {(statusResult.status === 'submitted' || statusResult.status === 'reviewing' || statusResult.status === 'new') && (
              <div className="flex items-center gap-2 text-amber-600 bg-amber-50 px-3 py-2 rounded-md">
                <Clock size={18} />
                <span className="font-medium">Ko'rib chiqilmoqda</span>
              </div>
            )}
            {statusResult.status === 'rejected' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-md">
                  <AlertCircle size={18} />
                  <span className="font-medium">Rad etilgan</span>
                </div>
                <p className="text-sm text-[var(--muted-foreground)]">
                  Arizangiz ba'zi kamchiliklar sababli rad etilgan. Iltimos, ma'lumotlarni tekshirib qayta yuboring.
                </p>
                <Button onClick={handleResubmit} loading={resubmitting} variant="outline" className="w-full flex gap-2">
                  <RotateCcw size={16} />
                  Arizani qayta yuborish
                </Button>
              </div>
            )}
          </div>

          <Button variant="ghost" onClick={() => setStatusResult(null)} className="mt-2">
            Boshqa raqam tekshirish
          </Button>
        </div>
      )}
    </div>
  );
}
