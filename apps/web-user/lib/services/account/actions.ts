"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api } from "@/lib/api";
import { getSession } from "@/lib/auth/session";
import { defaultLocale, isLocale } from "@/i18n/config";
import { safeAction } from "@/lib/services/safe-action";

export interface ProfileState {
  ok: boolean;
  error?: string;
}

export async function updateProfileAction(
  _prev: ProfileState,
  formData: FormData,
): Promise<ProfileState> {
  const rawLocale = String(formData.get("locale") ?? defaultLocale);
  const locale = isLocale(rawLocale) ? rawLocale : defaultLocale;

  const session = await getSession();
  if (!session) {
    redirect(`/${locale}/login`);
  }

  const input = {
    firstName: String(formData.get("firstName") ?? "").trim(),
    lastName: String(formData.get("lastName") ?? "").trim(),
    email: String(formData.get("email") ?? "").trim(),
  };

  return safeAction<ProfileState>(
    async () => {
      await api.users.updateProfile(input, { token: session.accessToken });
      revalidatePath("/", "layout");
      return { ok: true };
    },
    { ok: false, error: "ERROR" },
  );
}
