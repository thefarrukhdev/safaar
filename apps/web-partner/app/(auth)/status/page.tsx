"use client";

import { useState } from "react";
import Link from "next/link";
import { Phone, Search, ArrowLeft, CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../_components/ui/button";
import { Label } from "../../_components/ui/label";
import { PhoneInput } from "../../_components/ui/phone-input";
import { normalizePhone } from "../../_lib/utils/phone";
import {
  getPartnerAccessStatus,
  type PartnerAccessStatus,
  type PartnerAccessRequestDetails,
} from "../../_lib/api/endpoints/access";

export default function ApplicationStatusPage() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [statusResult, setStatusResult] = useState<{
    found: boolean;
    status: PartnerAccessStatus;
    request?: PartnerAccessRequestDetails | null;
  } | null>(null);

  const handleCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    const digits = normalizePhone(phone);
    if (digits.length < 9) {
      setStatusError("Telefon raqamini to'liq kiriting");
      return;
    }
    setStatusError(null);
    setLoading(true);
    setStatusResult(null);
    try {
      const formattedPhone = digits.startsWith('998') ? `+${digits}` : `+998${digits}`;
      const res = await getPartnerAccessStatus(formattedPhone);
      if (!res.found) {
        setStatusResult(null);
        setStatusError("Bunday raqamga bog'liq ariza topilmadi");
        toast.error("Bunday raqamga bog'liq ariza topilmadi");
      } else {
        setStatusResult(res);
      }
    } catch {
      setStatusResult(null);
      setStatusError("Ariza holatini tekshirib bo'lmadi");
      toast.error("Ariza holatini tekshirib bo'lmadi");
    } finally {
      setLoading(false);
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
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Login sahifasiga qaytish
        </Link>
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100/80">
            <Search className="h-4 w-4" aria-hidden="true" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Ariza holatini tekshirish
          </h2>
        </div>
        <p className="text-sm text-slate-500 leading-normal">
          Arizangiz qaysi bosqichda ekanligini ko&apos;rish uchun ariza berilgan telefon raqamingizni kiriting.
        </p>
      </div>

      {(!statusResult || !statusResult.found) && (
        <form onSubmit={handleCheck} className="flex flex-col gap-4" noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="status-phone" className="text-xs font-bold text-slate-700">
              Telefon raqam
            </Label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" aria-hidden="true" />
              <PhoneInput
                id="status-phone"
                required
                autoComplete="tel"
                inputMode="tel"
                aria-invalid={!!statusError}
                aria-describedby={statusError ? "status-phone-error" : undefined}
                value={phone}
                onChange={(e) => {
                  setPhone(e.target.value);
                  if (statusError) setStatusError(null);
                }}
                placeholder="+998 90 123 45 67"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:border-blue-600 aria-[invalid=true]:border-red-500 aria-[invalid=true]:ring-red-500/20 aria-[invalid=true]:focus:border-red-600 aria-[invalid=true]:focus:ring-red-500/25 aria-invalid:border-red-500 aria-invalid:ring-red-500/20 aria-invalid:focus:border-red-600 aria-invalid:focus:ring-red-500/25 transition-all shadow-2xs"
              />
            </div>
            {statusError && (
              <p
                id="status-phone-error"
                role="alert"
                className="text-xs text-rose-600 font-medium flex items-center gap-1 mt-0.5 animate-in fade-in-50"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {statusError}
              </p>
            )}
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
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5 text-emerald-800 bg-emerald-50 border border-emerald-200/80 px-3.5 py-2.5 rounded-xl text-sm font-semibold">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" aria-hidden="true" />
                  <span>Tasdiqlangan</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Arizangiz muvaffaqiyatli tasdiqlangan. Endi parolingiz bilan tizimga kirishingiz mumkin.
                </p>
                <Link href="/login" className="w-full inline-block">
                  <Button
                    className="w-full text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/25 cursor-pointer"
                    size="lg"
                  >
                    Tizimga kirish
                  </Button>
                </Link>
              </div>
            )}
            {(statusResult.status === 'submitted' || statusResult.status === 'reviewing' || statusResult.status === 'new') && (
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2.5 text-amber-800 bg-amber-50 border border-amber-200/80 px-3.5 py-2.5 rounded-xl text-sm font-semibold">
                  <Clock className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
                  <span>Ko&apos;rib chiqilmoqda</span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Arizangiz qabul qilingan va admin tomonidan ko&apos;rib chiqilmoqda. Natija haqida tez orada SMS orqali xabar beriladi.
                </p>
              </div>
            )}
            {statusResult.status === 'rejected' && (
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2.5 text-rose-800 bg-rose-50 border border-rose-200/80 px-3.5 py-2.5 rounded-xl text-sm font-semibold">
                  <AlertCircle className="h-5 w-5 text-rose-600 shrink-0" aria-hidden="true" />
                  <span>Rad etilgan</span>
                </div>
                {statusResult.request.rejectionReason && (
                  <p className="text-xs text-rose-700 bg-rose-50/80 p-2.5 rounded-lg border border-rose-200/60 font-medium">
                    Sabab: {statusResult.request.rejectionReason}
                  </p>
                )}
                <p className="text-xs text-slate-600 leading-relaxed">
                  Arizangiz ba&apos;zi kamchiliklar sababli rad etilgan. Iltimos, ma&apos;lumotlarni tekshirib yangi ariza yuboring.
                </p>
                <Link href="/register" className="w-full inline-block">
                  <Button
                    variant="outline"
                    className="w-full flex items-center justify-center gap-2 text-xs font-semibold rounded-xl border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
                    size="lg"
                  >
                    Yangi ariza topshirish
                  </Button>
                </Link>
              </div>
            )}
          </div>

          <Button
            variant="ghost"
            onClick={() => {
              setStatusResult(null);
              setStatusError(null);
              setPhone("");
            }}
            className="mt-1 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Boshqa raqam tekshirish
          </Button>
        </div>
      )}
    </div>
  );
}
