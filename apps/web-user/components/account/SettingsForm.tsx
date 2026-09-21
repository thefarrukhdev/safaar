"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import {
  updateNotificationPreferencesAction,
  requestDataExportAction,
  requestAccountDeletionAction,
} from "@/lib/account/actions";
import { CheckCircle2, AlertCircle, DownloadCloud, Trash2, Bell, Smartphone } from "lucide-react";

export function SettingsForm({
  preferences, dict,
}: {
  preferences: { emailAlerts?: boolean; smsAlerts?: boolean } | null;
  dict: any;
}) {
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const handlePreferences = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const res = await updateNotificationPreferencesAction(formData);
    setLoading(false);
    if (res?.ok) {
      alert(dict.updated || "Preferences updated!");
    } else {
      alert(res?.error || dict.updateFailed || "Update failed");
    }
  };

  const handleExport = async () => {
    setExportLoading(true);
    const res = await requestDataExportAction();
    setExportLoading(false);
    if (res?.ok) {
      alert(dict.exportRequested || "Data export requested!");
    } else {
      alert(res?.error || dict.exportFailed || "Export request failed");
    }
  };

  const handleDelete = async () => {
    if (!confirm(dict.deleteConfirm || "Are you sure you want to request account deletion?")) return;
    setDeleteLoading(true);
    const res = await requestAccountDeletionAction();
    setDeleteLoading(false);
    if (res?.ok) {
      alert(dict.deleteRequested || "Account deletion requested!");
    } else {
      alert(res?.error || dict.deleteFailed || "Deletion request failed");
    }
  };

  return (
    <div className="flex flex-col gap-10">
      <form onSubmit={handlePreferences} className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{dict.notificationPrefs || "Notification Preferences"}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Bizdan keladigan bildirishnomalarni boshqaring.</p>
        </div>
        
        <div className="flex flex-col gap-4">
          <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
            <input
              type="checkbox"
              name="emailAlerts"
              defaultChecked={preferences?.emailAlerts}
              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Bell className="h-4 w-4 text-slate-400" />
                {dict.emailAlerts || "Email Alerts"}
              </span>
              <span className="text-xs text-slate-500">Muhim yangiliklar va chegirmalar haqida emaildan xabar olish.</span>
            </div>
          </label>
          
          <label className="flex items-center gap-3 cursor-pointer p-4 rounded-xl border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
            <input
              type="checkbox"
              name="smsAlerts"
              defaultChecked={preferences?.smsAlerts}
              className="h-5 w-5 rounded border-slate-300 text-blue-600 focus:ring-blue-600 dark:border-slate-700 dark:bg-slate-900"
            />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-slate-400" />
                {dict.smsAlerts || "SMS Alerts"}
              </span>
              <span className="text-xs text-slate-500">Bron qilish tasdiqlanishi kabi tezkor SMS xabarlar.</span>
            </div>
          </label>
        </div>
        
        <div>
          <Button type="submit" size="md" loading={loading}>{dict.savePrefs || "Save Preferences"}</Button>
        </div>
      </form>

      <div className="flex flex-col gap-6 border-t border-slate-100 dark:border-slate-800 pt-8">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">{dict.dataManagement || "Data Management"}</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Shaxsiy ma'lumotlaringizni yuklab olishingiz yoki akkauntni o'chirishingiz mumkin.</p>
        </div>
        
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            variant="secondary"
            onClick={handleExport}
            loading={exportLoading}
            className="flex items-center gap-2 justify-center"
          >
            <DownloadCloud className="h-4 w-4" />
            {dict.requestExport || "Request Data Export"}
          </Button>
          <Button
            variant="ghost"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30 flex items-center gap-2 justify-center"
            onClick={handleDelete}
            loading={deleteLoading}
          >
            <Trash2 className="h-4 w-4" />
            {dict.requestDeletion || "Request Account Deletion"}
          </Button>
        </div>
      </div>
    </div>
  );
}
