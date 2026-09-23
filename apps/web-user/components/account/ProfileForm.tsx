"use client";

import { useActionState } from "react";
import type { Locale } from "@/i18n/config";
import type { AccountDict } from "@/i18n/dictionaries";
import {
  updateProfileAction,
  type ProfileState,
} from "@/lib/account/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import type { ProfileView } from "@/types/view";
import { AvatarForm } from "./AvatarForm";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useEffect } from "react";

export function ProfileForm({
  locale,
  profile,
  dict,
  avatarDict,
}: {
  locale: Locale;
  profile: ProfileView;
  dict: AccountDict["profile"];
  avatarDict?: Record<string, string>;
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateProfileAction,
    { ok: false },
  );

  useEffect(() => {
    if (state.ok) {
      toast.success(dict.saved);
    } else if (state.error) {
      toast.error(dict.error);
    }
  }, [state, dict]);

  return (
    <div className="flex flex-col gap-8">
      {/* Avatar section */}
      <AvatarForm profile={profile} dict={avatarDict || {}} />

      {/* Form section */}
      <form action={action} className="flex flex-col gap-6">
        <input type="hidden" name="locale" value={locale} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dict.firstName}</span>
            <Input
              name="firstName"
              autoComplete="given-name"
              defaultValue={profile.firstName}
              className="bg-slate-50 hover:bg-slate-100 focus:bg-white dark:bg-slate-900/50"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dict.lastName}</span>
            <Input
              name="lastName"
              autoComplete="family-name"
              defaultValue={profile.lastName}
              className="bg-slate-50 hover:bg-slate-100 focus:bg-white dark:bg-slate-900/50"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dict.email}</span>
            <Input
              name="email"
              type="email"
              autoComplete="email"
              defaultValue={profile.email}
              className="bg-slate-50 hover:bg-slate-100 focus:bg-white dark:bg-slate-900/50"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{dict.phone}</span>
              <span className="text-[11px] font-medium tracking-wide text-slate-400 uppercase">{dict.phoneHint}</span>
            </div>
            <Input
              name="phone"
              type="tel"
              disabled
              defaultValue={profile.phone}
              className="bg-slate-100 text-slate-500 opacity-70 cursor-not-allowed dark:bg-slate-800"
            />
          </label>
        </div>

        {/* Submit area */}
        <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-6">
          <div className="flex-1">
            {state.ok && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
                {dict.saved}
              </p>
            )}
            {state.error && (
              <p className="flex items-center gap-1.5 text-sm font-medium text-red-600 dark:text-red-400">
                <AlertCircle className="h-4 w-4" />
                {dict.error}
              </p>
            )}
          </div>
          <Button type="submit" size="md" className="sm:w-auto w-full px-8" loading={pending}>
            {dict.save}
          </Button>
        </div>
      </form>
    </div>
  );
}
