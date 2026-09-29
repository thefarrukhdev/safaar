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
      <h2 className="text-2xl font-bold text-slate-900">{dict.title}</h2>
      <div className="flex flex-wrap gap-2">
        {checkInTime && (
          <div className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 gap-1.5">
            <Clock className="h-4 w-4" />
            <span>
              {dict.checkIn}: {dict.checkInFrom.replace("{time}", checkInTime)}
            </span>
          </div>
        )}
        
        {checkOutTime && (
          <div className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 gap-1.5">
            <Clock className="h-4 w-4" />
            <span>
              {dict.checkOut}: {dict.checkOutUntil.replace("{time}", checkOutTime)}
            </span>
          </div>
        )}

        {cancellationPolicyCode && (
          <div className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 gap-1.5">
            <AlertCircle className="h-4 w-4" />
            <span>
              {dict.cancellation}: {cancellationPolicyCode === "FLEXIBLE" && dict.cancellation_FLEXIBLE}
              {cancellationPolicyCode === "MODERATE" && dict.cancellation_MODERATE}
              {cancellationPolicyCode === "STRICT" && dict.cancellation_STRICT}
              {cancellationPolicyCode === "NON_REFUNDABLE" && dict.cancellation_NON_REFUNDABLE}
              {!["FLEXIBLE", "MODERATE", "STRICT", "NON_REFUNDABLE"].includes(cancellationPolicyCode) && cancellationPolicyCode}
            </span>
          </div>
        )}

        {allowSmoking !== undefined && (
          <div className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 gap-1.5">
            <CigaretteOff className="h-4 w-4" />
            <span>
              {dict.smoking}: {allowSmoking ? dict.smokingAllowed : dict.smokingNotAllowed}
            </span>
          </div>
        )}

        {allowPets !== undefined && (
          <div className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 gap-1.5">
            <PawPrint className="h-4 w-4" />
            <span>
              {dict.pets}: {allowPets ? dict.petsAllowed : dict.petsNotAllowed}
            </span>
          </div>
        )}

        {allowChildren !== undefined && (
          <div className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 gap-1.5">
            <Baby className="h-4 w-4" />
            <span>
              {dict.children}: {allowChildren ? dict.childrenAllowed : dict.childrenNotAllowed}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
