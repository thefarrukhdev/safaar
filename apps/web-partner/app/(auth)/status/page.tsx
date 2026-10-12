"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Search, CheckCircle2, AlertCircle, Clock, RotateCcw, Phone } from "lucide-react";
import { Button } from "../../_components/ui/button";
import { PhoneInput } from "../../_components/ui/phone-input";
import { Label } from "../../_components/ui/label";
import { access } from "../../_lib/api";
import { normalizePhone } from "../../_lib/utils/phone";
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
    <div className="flex flex-col gap-6 animate-in fade-in-50 duration-200">
      {/* Header & Back Navigation */}
      <div className="flex flex-col gap-2">
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors w-fit mb-0.5 cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Login sahifasiga qaytish
        </Link>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100/80">
            <Search className="h-4 w-4" aria-hidden />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Ariza holatini tekshirish
          </h2>
        </div>
        <p className="text-sm text-slate-500 leading-normal">
          Arizangiz qaysi bosqichda ekanligini ko'rish uchun ariza berilgan telefon raqamingizni kiriting.
        </p>
      </div>

      {!statusResult && (
        <form onSubmit={handleCheck} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status-phone" className="text-xs font-bold text-slate-700">
              Telefon raqam
            </Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" />
              <PhoneInput
                id="status-phone"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+998 90 123 45 67"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white transition-all shadow-2xs"
              />
            </div>
          </div>
          <Button
            type="submit"
            size="lg"
            loading={loading}
            className="w-full text-sm font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/25 active:scale-[0.99] transition-all cursor-pointer"
          >
            Tekshirish
          </Button>
        </form>
      )}

      {statusResult && statusResult.found && statusResult.request && (
        <div className="flex flex-col gap-5 p-6 border border-slate-200/90 rounded-2xl bg-white shadow-sm">
          <div className="pb-4 border-b border-slate-100">
            <p className="text-xs font-medium text-slate-500 mb-1">Kompaniya / Obyekt nomi</p>
            <p className="text-base font-bold text-slate-900">{statusResult.request.companyName}</p>
          </div>

          <div>
            <p className="text-xs font-medium text-slate-500 mb-2">Ariza holati</p>
            {statusResult.status === 'approved' && (
              <div className="flex items-center gap-2.5 text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3.5 py-2.5 rounded-xl text-sm font-semibold">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>Tasdiqlangan</span>
              </div>
            )}
            {(statusResult.status === 'submitted' || statusResult.status === 'reviewing' || statusResult.status === 'new') && (
              <div className="flex items-center gap-2.5 text-amber-800 bg-amber-50 border border-amber-200/80 px-3.5 py-2.5 rounded-xl text-sm font-semibold">
                <Clock className="h-5 w-5 text-amber-600 shrink-0" />
                <span>Ko'rib chiqilmoqda</span>
              </div>
            )}
            {statusResult.status === 'rejected' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5 text-rose-800 bg-rose-50 border border-rose-200/80 px-3.5 py-2.5 rounded-xl text-sm font-semibold">
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" />
                  <span>Rad etilgan</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Arizangiz ba'zi kamchiliklar sababli rad etilgan. Iltimos, ma'lumotlarni tekshirib qayta yuboring.
                </p>
                <Button
                  onClick={handleResubmit}
                  loading={resubmitting}
                  variant="outline"
                  className="w-full flex items-center justify-center gap-2 text-xs font-semibold rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Arizani qayta yuborish
                </Button>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            onClick={() => setStatusResult(null)}
            className="mt-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Boshqa raqam tekshirish
          </Button>
        </div>
      )}
    </div>
  );
}
