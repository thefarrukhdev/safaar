import { FileText, ShieldAlert, BadgeInfo, AlertTriangle, UserCheck } from "lucide-react";
import type { TransportDict } from "@/i18n/dictionaries";

export function TransportRules({ dict }: { dict?: TransportDict["rulesSection"] }) {
  if (!dict) return null;

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{dict.title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <UserCheck className="mt-0.5 h-5 w-5 text-slate-600 dark:text-slate-400" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{dict.age}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{dict.ageDesc}</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <FileText className="mt-0.5 h-5 w-5 text-slate-600 dark:text-slate-400" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{dict.documents}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{dict.documentsDesc}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-slate-600 dark:text-slate-400" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{dict.deposit}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{dict.depositDesc}</p>
          </div>
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-500" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{dict.smoking}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{dict.smokingDesc}</p>
          </div>
        </div>
        
        <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
          <BadgeInfo className="mt-0.5 h-5 w-5 text-slate-600 dark:text-slate-400" />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">{dict.mileage}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{dict.mileageDesc}</p>
          </div>
        </div>

      </div>
    </div>
  );
}
