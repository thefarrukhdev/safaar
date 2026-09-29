import { Clock, CigaretteOff, PawPrint, Baby, AlertCircle } from "lucide-react";
import type { HotelDetailDict } from "@/i18n/dictionaries";

export function HotelRules({
  checkInTime,
  checkOutTime,
  cancellationPolicyCode,
  allowSmoking,
  allowPets,
  allowChildren,
  dict,
}: {
  checkInTime?: string;
  checkOutTime?: string;
  cancellationPolicyCode?: string;
  allowSmoking?: boolean;
  allowPets?: boolean;
  allowChildren?: boolean;
  dict: HotelDetailDict["rulesSection"];
}) {
  if (!dict) return null;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{dict.title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {checkInTime && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <Clock className="mt-0.5 h-5 w-5 text-slate-600 dark:text-slate-400" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{dict.checkIn}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{dict.checkInFrom.replace("{time}", checkInTime)}</p>
            </div>
          </div>
        )}
        
        {checkOutTime && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <Clock className="mt-0.5 h-5 w-5 text-slate-600 dark:text-slate-400" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{dict.checkOut}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">{dict.checkOutUntil.replace("{time}", checkOutTime)}</p>
            </div>
          </div>
        )}

        {cancellationPolicyCode && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <AlertCircle className="mt-0.5 h-5 w-5 text-slate-600 dark:text-slate-400" />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{dict.cancellation}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {cancellationPolicyCode === "FLEXIBLE" && dict.cancellation_FLEXIBLE}
                {cancellationPolicyCode === "MODERATE" && dict.cancellation_MODERATE}
                {cancellationPolicyCode === "STRICT" && dict.cancellation_STRICT}
                {cancellationPolicyCode === "NON_REFUNDABLE" && dict.cancellation_NON_REFUNDABLE}
                {!["FLEXIBLE", "MODERATE", "STRICT", "NON_REFUNDABLE"].includes(cancellationPolicyCode) && cancellationPolicyCode}
              </p>
            </div>
          </div>
        )}

        {allowSmoking !== undefined && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <CigaretteOff className={`mt-0.5 h-5 w-5 ${allowSmoking ? 'text-amber-500' : 'text-slate-600 dark:text-slate-400'}`} />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{dict.smoking}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {allowSmoking ? dict.smokingAllowed : dict.smokingNotAllowed}
              </p>
            </div>
          </div>
        )}

        {allowPets !== undefined && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <PawPrint className={`mt-0.5 h-5 w-5 ${allowPets ? 'text-emerald-500' : 'text-slate-600 dark:text-slate-400'}`} />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{dict.pets}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {allowPets ? dict.petsAllowed : dict.petsNotAllowed}
              </p>
            </div>
          </div>
        )}

        {allowChildren !== undefined && (
          <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
            <Baby className={`mt-0.5 h-5 w-5 ${allowChildren ? 'text-emerald-500' : 'text-slate-600 dark:text-slate-400'}`} />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">{dict.children}</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {allowChildren ? dict.childrenAllowed : dict.childrenNotAllowed}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
