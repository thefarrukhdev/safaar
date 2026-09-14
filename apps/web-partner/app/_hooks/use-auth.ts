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
      // ── Hamma uchun vaqtincha Demo rejim (Backend ulanmagan) ───────────────
      return {
        phone,
        challengeId: 'demo-challenge-id',
        expiresInSeconds: 300,
        resendAfterSeconds: 60,
        partnerType: 'hotel',
        devCode: '000000'
      };
      // ────────────────────────────────────────────────────────────────────────
    },
    onSuccess: ({ challengeId, phone }) => {
      toast.info(
        `Demo rejim: "000000" kodni kiriting`,
        { duration: 8000 },
      );
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
      // ── Hamma uchun vaqtincha Demo rejim (Backend ulanmagan) ───────────────
      if (password && password !== 'demo123') {
        throw new Error("Noto'g'ri parol. Hozircha demo parol: demo123 ni kiriting.");
      }
      return {
        phone,
        tokens: DEMO_TOKENS as any,
        organizationId: 'demo-org-id',
        partnerType: 'hotel',
        isDemo: true,
      };
      // ────────────────────────────────────────────────────────────────────────
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
      // ── Hamma uchun vaqtincha Demo rejim (Backend ulanmagan) ───────────────
      if (code !== '000000') {
        throw new Error("Demo rejimda kod: 000000 ni kiriting");
      }
      return {
        phone,
        tokens: DEMO_TOKENS as any,
        organizationId: 'demo-org-id',
        partnerType: 'hotel',
        isDemo: true,
      };
      // ────────────────────────────────────────────────────────────────────────
    },
    onSuccess: ({ phone, tokens, organizationId, partnerType, isDemo }) => {
      const { user } = buildPartnerSession(phone, tokens, partnerType, 'phone');
      user.organizationId = organizationId;
      setSession(user, tokens);
      toast.success("Parol muvaffaqiyatli saqlandi va tizimga kirdingiz!");
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
