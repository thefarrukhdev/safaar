"use client";

import {
  Clock,
  Cigarette,
  CigaretteOff,
  PawPrint,
  Baby,
  ShieldCheck,
  CreditCard,
  Banknote,
  FileText,
  AlertCircle,
} from "lucide-react";

interface RestaurantRulesSectionProps {
  rules?: {
    checkInTime?: string;
    checkOutTime?: string;
    smokingAllowed?: boolean;
    petsAllowed?: boolean;
    childrenAllowed?: boolean;
    cancellationPolicyCode?: string;
    customRules?: string[];
    allowsCash?: boolean;
    allowsOnlinePayment?: boolean;
  };
  workingHours?: string;
  title?: string;
}

export function RestaurantRulesSection({
  rules,
  workingHours,
  title = "Restoran tartib-qoidalari va shartlari",
}: RestaurantRulesSectionProps) {
  const displayHours =
    workingHours ||
    (rules?.checkInTime && rules?.checkOutTime
      ? `${rules.checkInTime} - ${rules.checkOutTime}`
      : "09:00 - 23:00");

  const cancellationText = (() => {
    switch (rules?.cancellationPolicyCode) {
      case "FLEXIBLE":
        return "Moslashuvchan: kelishdan 2 soat oldingacha bepul bekor qilish mumkin.";
      case "MODERATE":
        return "O'rtacha: kelishdan oldin bekor qilishda restoran ma'muriyati bilan kelishiladi.";
      case "STRICT":
        return "Qat'iy: bekor qilish faqat favqulodda hollarda qabul qilinadi.";
      case "NON_REFUNDABLE":
        return "Qaytarilmaydi: band qilingan stol oldindan tasdiqlanadi.";
      default:
        return "Kelish vaqtidan kamida 2 soat oldin xabar berish tavsiya etiladi.";
    }
  })();

  return (
    <section className="flex flex-col gap-4 border-t border-slate-200/80 pt-6">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-5 w-5 text-blue-600" />
        <h2 className="text-xl font-bold tracking-tight text-slate-900">
          {title}
        </h2>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* Working Hours */}
        <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Ish vaqti / Qabul</h4>
            <p className="mt-0.5 text-xs text-slate-600 font-medium">
              Har kuni: {displayHours}
            </p>
          </div>
        </div>

        {/* Smoking Policy */}
        <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
              rules?.smokingAllowed
                ? "bg-amber-50 text-amber-700"
                : "bg-emerald-50 text-emerald-700"
            }`}
          >
            {rules?.smokingAllowed ? (
              <Cigarette className="h-4 w-4" />
            ) : (
              <CigaretteOff className="h-4 w-4" />
            )}
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Chekish tartibi</h4>
            <p className="mt-0.5 text-xs text-slate-600 font-medium">
              {rules?.smokingAllowed
                ? "Chekishga ruxsat etilgan (maxsus zonada)"
                : "Asosiy zalda chekish taqiqlangan"}
            </p>
          </div>
        </div>

        {/* Children Policy */}
        <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700">
            <Baby className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Bolalar bilan tashrif</h4>
            <p className="mt-0.5 text-xs text-slate-600 font-medium">
              {rules?.childrenAllowed !== false
                ? "Bolalar bilan tashrif buyurish mumkin"
                : "Faqat kattalar uchun mo'ljallangan"}
            </p>
          </div>
        </div>

        {/* Pets Policy */}
        <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <PawPrint className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Uy hayvonlari</h4>
            <p className="mt-0.5 text-xs text-slate-600 font-medium">
              {rules?.petsAllowed
                ? "Uy hayvonlari bilan kirish mumkin"
                : "Uy hayvonlari bilan kirish taqiqlangan"}
            </p>
          </div>
        </div>

        {/* Cancellation Policy */}
        <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:col-span-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">
              Bekor qilish va kafolat
            </h4>
            <p className="mt-0.5 text-xs text-slate-600 font-medium">
              {cancellationText}
            </p>
          </div>
        </div>

        {/* Payment Methods */}
        <div className="flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white p-3.5 shadow-xs sm:col-span-2 lg:col-span-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
            <CreditCard className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-800">Qabul qilinadigan to'lovlar</h4>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600 font-medium">
              {rules?.allowsCash !== false && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                  <Banknote className="h-3 w-3 text-emerald-600" />
                  Naqd pul (Joyida)
                </span>
              )}
              {rules?.allowsOnlinePayment !== false && (
                <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-slate-700">
                  <CreditCard className="h-3 w-3 text-blue-600" />
                  Bank kartalari (Uzcard, Humo, Visa, Mastercard)
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Custom Rules If Any */}
      {rules?.customRules && rules.customRules.length > 0 && (
        <div className="rounded-xl border border-amber-200/70 bg-amber-50/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-amber-700" />
            <h4 className="text-xs font-bold text-amber-900">
              Qo'shimcha restoran qoidalari:
            </h4>
          </div>
          <ul className="space-y-1 pl-5 list-disc text-xs text-amber-900/80">
            {rules.customRules.map((rule, idx) => (
              <li key={idx}>{rule}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
