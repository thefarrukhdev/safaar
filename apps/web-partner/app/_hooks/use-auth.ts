'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { access, auth } from '../_lib/api';
import { buildPartnerSession } from '../_lib/auth/session';
import { useAuthStore } from '../_stores/auth-store';

export function usePartnerPhoneLogin() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: async (phone: string) => {
      const accessStatus = await access.getPartnerAccessStatus(phone);
      if (accessStatus.status !== 'approved') {
        if (accessStatus.status === 'rejected') {
          throw new Error("Arizangiz rad etilgan. Admin bilan bog'laning.");
        }
        if (
          accessStatus.status === 'new' ||
          accessStatus.status === 'reviewing' ||
          accessStatus.status === 'submitted'
        ) {
          throw new Error('Arizangiz hali admin tomonidan tasdiqlanmagan.');
        }
        throw new Error(
          'Bu telefon uchun hamkorlik access topilmadi. Avval ariza yuboring.',
        );
      }

      const tokens = await auth.partnerPhoneLogin(phone);
      // `tokens.organizationType` (partner_organizations.type, from
      // issuePartnerTokensByPhone) is the authoritative source — prefer it
      // over the pre-login access-status lookup, which is a separate,
      // potentially-stale snapshot.
      const partnerType =
        tokens.organizationType ??
        tokens.organization_type ??
        accessStatus.request?.type ??
        'hotel';
      return {
        phone,
        tokens,
        organizationId: tokens.organizationId ?? tokens.organization_id,
        partnerType,
      };
    },
    onSuccess: ({ phone, tokens, organizationId, partnerType }) => {
      const { user } = buildPartnerSession(phone, tokens, partnerType, 'phone');
      user.organizationId = organizationId;
      setSession(user, tokens);
      toast.success('Xush kelibsiz!');
      router.replace('/');
    },
    onError: (error) => {
      toast.error(error.message || 'Kirish uchun access topilmadi');
    },
  });
}

export function usePartnerPhoneOtpRequest() {
  return useMutation({
    mutationFn: async (phone: string) => {
      const result = await auth.requestOtp(phone);
      return {
        phone,
        challengeId: result.challenge_id,
        expiresInSeconds: result.expires_in_seconds,
        resendAfterSeconds: result.resend_after_seconds,
        devCode: result.dev_code,
      };
    },
    onSuccess: ({ devCode }) => {
      if (devCode) {
        // Faqat QA/dev muhitida keladi (ENABLE_DEMO_AUTH yoki telefon
        // allowlist) — production'da backend bu maydonni umuman
        // qaytarmaydi, shuning uchun bu yerda hech qanday qo'shimcha
        // shart kerak emas.
        toast.info(`Dasturlash rejimi kodi: ${devCode}`, { duration: 8000 });
      }
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Kod yuborishda xatolik yuz berdi';
      toast.error(message);
    },
  });
}

/** Registration'ning phone-ownership qadami (1/2) — `usePartnerPhoneOtpRequest`
 * bilan ATAYLAB bog'lanmagan: u LOGIN uchun `'partner_login'` OTP purpose'ini
 * ishlatadi, bu esa `'partner_registration'`ni — hali mavjud bo'lmagan
 * hisob uchun. register/page.tsx shuni ishlatishi kerak, `usePartnerPhoneOtpRequest`
 * emas (oldingi versiyada noto'g'ri ishlatilgan edi). */
export function usePartnerRegistrationOtpRequest() {
  return useMutation({
    mutationFn: async (phone: string) => {
      const result = await auth.requestPartnerRegistrationOtp(phone);
      return {
        phone,
        challengeId: result.challenge_id,
        expiresInSeconds: result.expires_in_seconds,
        resendAfterSeconds: result.resend_after_seconds,
        devCode: result.dev_code,
      };
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : 'Kod yuborishda xatolik yuz berdi';
      toast.error(message);
    },
  });
}

/** Registration'ning phone-ownership qadami (2/2): hech qanday token/session
 * chiqarmaydi (hali hisob yo'q) — faqat bir martalik `verificationToken`,
 * shuni keyingi `submitPartnerApplication()` chaqiruviga uzatish kerak. */
export function usePartnerRegistrationOtpVerify() {
  return useMutation({
    mutationFn: async ({
      phone,
      code,
      challengeId,
    }: {
      phone: string;
      code: string;
      challengeId: string;
    }) => {
      const result = await auth.verifyPartnerRegistrationOtp({
        phone,
        code,
        challenge_id: challengeId,
      });
      return {
        verificationToken: result.verification_token,
        expiresInSeconds: result.expires_in_seconds,
      };
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Kod noto'g'ri yoki muddati tugagan";
      toast.error(message);
    },
  });
}

export function usePartnerPhoneOtpVerify() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: async ({
      phone,
      code,
      challengeId,
      partnerType,
    }: {
      phone: string;
      code: string;
      challengeId: string;
      partnerType?: string;
    }) => {
      const tokens = await auth.verifyOtp({
        phone,
        code,
        challenge_id: challengeId,
      });

      return {
        phone,
        tokens,
        organizationId: tokens.organizationId ?? tokens.organization_id,
        // `tokens.organizationType` (authoritative, from the backend) takes
        // priority over the `partnerType` the caller passed in.
        partnerType:
          tokens.organizationType ?? tokens.organization_type ?? partnerType ?? 'hotel',
      };
    },
    onSuccess: ({ phone, tokens, organizationId, partnerType }) => {
      const { user } = buildPartnerSession(phone, tokens, partnerType, 'phone');
      user.organizationId = organizationId;
      setSession(user, tokens);
      toast.success('Xush kelibsiz!');
      router.replace('/');
    },
    onError: (error) => {
      toast.error(error.message || "Kod noto'g'ri yoki muddati tugagan");
    },
  });
}

export function usePartnerPasswordLogin() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: async ({
      phone,
      password,
    }: {
      phone: string;
      password?: string;
    }) => {
      const tokens = await auth.partnerPasswordLogin(phone, password);
      return {
        phone,
        tokens,
        organizationId: tokens.organizationId ?? tokens.organization_id,
        // Was hardcoded 'hotel' regardless of the real organization type
        // (confirmed live: restaurant/transport test partners both showed
        // a hotel-style dashboard after password login). Now uses the
        // authoritative partner_organizations.type the backend returns.
        partnerType: tokens.organizationType ?? tokens.organization_type ?? 'hotel',
      };
    },
    onSuccess: ({ phone, tokens, organizationId, partnerType }) => {
      const { user } = buildPartnerSession(phone, tokens, partnerType, 'phone');
      user.organizationId = organizationId;
      setSession(user, tokens);
      toast.success('Xush kelibsiz!');
      router.replace('/');
    },
    onError: (error) => {
      toast.error(error.message || 'Kirishda xatolik yuz berdi');
    },
  });
}

export function usePartnerSetPassword() {
  const router = useRouter();
  const setSession = useAuthStore((s) => s.setSession);

  return useMutation({
    mutationFn: async ({
      phone,
      code,
      challengeId,
      password,
    }: {
      phone: string;
      code: string;
      challengeId: string;
      password?: string;
    }) => {
      const tokens = await auth.partnerSetPassword({
        phone,
        code,
        challenge_id: challengeId,
        password,
      });
      return {
        phone,
        tokens,
        organizationId: tokens.organizationId ?? tokens.organization_id,
        partnerType: tokens.organizationType ?? tokens.organization_type ?? 'hotel',
      };
    },
    onSuccess: ({ phone, tokens, organizationId, partnerType }) => {
      const { user } = buildPartnerSession(phone, tokens, partnerType, 'phone');
      user.organizationId = organizationId;
      setSession(user, tokens);
      toast.success('Parol muvaffaqiyatli saqlandi va tizimga kirdingiz!');
      router.replace('/');
    },
    onError: (error) => {
      toast.error(error.message || "Parolni o'rnatishda xatolik yuz berdi");
    },
  });
}

export function useLogout() {
  const router = useRouter();
  const clearSession = useAuthStore((s) => s.clearSession);

  return () => {
    const token = useAuthStore.getState().tokens?.accessToken ?? null;
    // Backendga logout so'rovi "best-effort" — token allaqachon eskirgan/
    // tarmoq xato bo'lsa ham, mahalliy sessiyani tozalash va chiqishni
    // TO'XTATMASLIK kerak (aks holda foydalanuvchi hech qachon chiqib
    // ketolmasligi mumkin bo'lgan holat yuzaga kelardi).
    void auth.partnerLogout(token).catch(() => {});
    clearSession();
    toast.success('Sessiya yakunlandi');
    router.replace('/login');
  };
}
