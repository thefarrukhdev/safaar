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

export function ProfileForm({
  locale,
  profile,
  dict,
}: {
  locale: Locale;
  profile: ProfileView;
  dict: AccountDict["profile"];
}) {
  const [state, action, pending] = useActionState<ProfileState, FormData>(
    updateProfileAction,
    { ok: false },
  );

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="locale" value={locale} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{dict.firstName}</span>
          <Input
            name="firstName"
            autoComplete="given-name"
            defaultValue={profile.firstName}
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{dict.lastName}</span>
          <Input
            name="lastName"
            autoComplete="family-name"
            defaultValue={profile.lastName}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{dict.email}</span>
        <Input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={profile.email}
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium">{dict.phone}</span>
        <Input
          name="phone"
          type="tel"
          disabled
          defaultValue={profile.phone}
        />
        <span className="text-xs text-slate-500">{dict.phoneHint}</span>
      </label>

      {state.ok && (
        <p className="text-sm text-green-600 dark:text-green-400">
          {dict.saved}
        </p>
      )}
      {state.error && <p className="text-sm text-red-600">{dict.error}</p>}

      <div>
        <Button type="submit" size="lg" loading={pending} className="rounded-full active:scale-[0.97]">
          {dict.save}
        </Button>
      </div>
    </form>
  );
}
