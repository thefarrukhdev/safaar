'use client';

import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { access, auth } from '../_lib/api';
import { buildPartnerSession } from '../_lib/auth/session';
import { useAuthStore } from '../_stores/auth-store';

// ─── Demo rejim ───────────────────────────────────────────────────────────────
// Backend o'chiq bo'lganda ishlab chiqish uchun ishlatiladi.
// HECH QACHON production'ga chiqarma.
const DEMO_PHONE = '+998901234567';
const DEMO_CODE = '000000';
const DEMO_TOKENS = {
  accessToken: 'demo.eyJzdWIiOiJkZW1vLXVzZXIiLCJvcmdhbml6YXRpb25faWQiOiJkZW1vLW9yZyJ9.demo',
  refreshToken: 'demo-refresh-token',
  organization_id: 'demo-org-id',
  organizationId: 'demo-org-id',
  partner_role: 'owner',
};
// ─────────────────────────────────────────────────────────────────────────────

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
      const partnerType = accessStatus.request?.type || 'hotel';
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
      const normalizedPhone = phone.replace(/\D/g, '');

      // ── Demo rejim ──────────────────────────────────────────────────────────
      if (phone === DEMO_PHONE || normalizedPhone === '998901234567') {
        return {
          phone,
          challengeId: 'demo-challenge-id',
          expiresInSeconds: 300,
          resendAfterSeconds: 60,
          partnerType: 'hotel',
        };
      }
      // ────────────────────────────────────────────────────────────────────────

      const accessStatus = await access
        .getPartnerAccessStatus({ phone })
        .catch(() => ({ status: 'approved' as const, request: { type: 'hotel' } }));

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
          'Bu telefon raqam uchun hamkorlik access topilmadi. Avval ariza yuboring.',
        );
      }

      let challenge;
      try {
        challenge = await auth.requestOtp(phone);
      } catch {
        // Backend o'chiq — demo rejimga o'tamiz
        challenge = {
          sent: true,
          challenge_id: 'demo-challenge-id',
          expires_in_seconds: 300,
          resend_after_seconds: 60,
        };
      }

      return {
        phone,
        challengeId: challenge.challenge_id,
        expiresInSeconds: challenge.expires_in_seconds,
        resendAfterSeconds: challenge.resend_after_seconds,
        partnerType: accessStatus.request?.type || 'hotel',
        devCode: challenge.dev_code,
      };
    },
    onSuccess: ({ challengeId, phone }) => {
      if (challengeId === 'demo-challenge-id') {
        toast.info(
          `Demo rejim: ${phone === DEMO_PHONE ? `"${DEMO_CODE}"` : '"000000"'} kodni kiriting`,
          { duration: 8000 },
        );
      } else {
        toast.success(
          '📱 SMS orqali kod yuborildi',
          { duration: 4000 },
        );
      }
    },
    onError: (error) => {
      toast.error(error.message || 'Kod yuborishda xatolik yuz berdi');
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
      // ── Demo rejim ──────────────────────────────────────────────────────────
      if (challengeId === 'demo-challenge-id') {
        if (code !== DEMO_CODE) {
          throw new Error(`Demo rejimda kod: ${DEMO_CODE}`);
        }
        return {
          phone,
          tokens: DEMO_TOKENS as any,
          organizationId: 'demo-org-id',
          partnerType: partnerType || 'hotel',
          isDemo: true,
        };
      }
      // ────────────────────────────────────────────────────────────────────────

      const tokens = await auth.verifyOtp({
        phone,
        code,
        challenge_id: challengeId,
      }) as any;

      return {
        phone,
        tokens,
        organizationId: tokens.organizationId ?? tokens.organization_id,
        partnerType: partnerType || 'hotel',
        isDemo: false,
      };
    },
    onSuccess: ({ phone, tokens, organizationId, partnerType, isDemo }) => {
      const { user } = buildPartnerSession(phone, tokens, partnerType, 'phone');
      user.organizationId = organizationId;
      setSession(user, tokens);
      if (isDemo) {
        toast.success('Demo rejimda kirildingiz. Ma\'lumotlar ko\'rsatilmaydi.');
      } else {
        toast.success('Xush kelibsiz!');
      }
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
    mutationFn: async ({ phone, password }: { phone: string; password?: string }) => {
      // ── Demo rejim ──────────────────────────────────────────────────────────
      if (phone === DEMO_PHONE || phone.replace(/\D/g, '') === '998901234567') {
        if (password && password !== 'demo123') {
          throw new Error("Noto'g'ri parol. Demo parol: demo123");
        }
        return {
          phone,
          tokens: DEMO_TOKENS as any,
          organizationId: 'demo-org-id',
          partnerType: 'hotel',
          isDemo: true,
        };
      }
      // ────────────────────────────────────────────────────────────────────────

      const accessStatus = await access.getPartnerAccessStatus(phone).catch(() => ({ status: 'approved', request: { type: 'hotel' } }));
      if (accessStatus.status !== 'approved') {
        throw new Error('Arizangiz hali admin tomonidan tasdiqlanmagan yoki topilmadi.');
      }

      const tokens = await auth.partnerPasswordLogin(phone, password) as any;
      return {
        phone,
        tokens,
        organizationId: tokens.organizationId ?? tokens.organization_id,
        partnerType: accessStatus.request?.type || 'hotel',
        isDemo: false,
      };
    },
    onSuccess: ({ phone, tokens, organizationId, partnerType, isDemo }) => {
      const { user } = buildPartnerSession(phone, tokens, partnerType, 'phone');
      user.organizationId = organizationId;
      setSession(user, tokens);
      if (isDemo) {
        toast.success("Demo rejimda kirildingiz.");
      } else {
        toast.success("Xush kelibsiz!");
      }
      router.replace('/');
    },
    onError: (error) => {
      toast.error(error.message || "Kirishda xatolik yuz berdi");
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
      // ── Demo rejim ──────────────────────────────────────────────────────────
      if (challengeId === 'demo-challenge-id') {
        if (code !== DEMO_CODE) {
          throw new Error(`Demo rejimda kod: ${DEMO_CODE}`);
        }
        return {
          phone,
          tokens: DEMO_TOKENS as any,
          organizationId: 'demo-org-id',
          partnerType: 'hotel',
          isDemo: true,
        };
      }
      // ────────────────────────────────────────────────────────────────────────

      const accessStatus = await access.getPartnerAccessStatus(phone).catch(() => ({ status: 'approved', request: { type: 'hotel' } }));
      
      const tokens = await auth.partnerSetPassword({
        phone,
        code,
        challenge_id: challengeId,
        password,
      }) as any;

      return {
        phone,
        tokens,
        organizationId: tokens.organizationId ?? tokens.organization_id,
        partnerType: accessStatus.request?.type || 'hotel',
        isDemo: false,
      };
    },
    onSuccess: ({ phone, tokens, organizationId, partnerType, isDemo }) => {
      const { user } = buildPartnerSession(phone, tokens, partnerType, 'phone');
      user.organizationId = organizationId;
      setSession(user, tokens);
      if (isDemo) {
        toast.success("Demo parol o'rnatildi.");
      } else {
        toast.success("Parol muvaffaqiyatli saqlandi va tizimga kirdingiz!");
      }
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
    clearSession();
    toast.success('Sessiya yakunlandi');
    router.replace('/login');
  };
}
