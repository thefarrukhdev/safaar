'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, Building2, CheckCircle2, Phone, KeyRound, Lock } from 'lucide-react';
import { Button } from '../../_components/ui/button';
import { Input } from '../../_components/ui/input';
import { Label } from '../../_components/ui/label';
import { access } from '../../_lib/api';
import { usePartnerPhoneOtpRequest } from '../../_hooks/use-auth';
import {
  isValidPhone,
  maskPhone,
  normalizePhone,
} from '../../_lib/utils/phone';

const schema = z.object({
  type: z.enum([
    'hotel',
    'bus',
    'hostel',
    'guesthouse',
    'motel',
    'dacha',
    'restaurant',
  ]),
  companyName: z.string().min(2, 'Obyekt/Kompaniya nomini kiriting'),
  contactPerson: z.string().min(2, "Mas'ul shaxsni kiriting"),
  phone: z
    .string()
    .min(1, 'Telefon raqamni kiriting')
    .refine(isValidPhone, "Telefon noto'g'ri formatda"),
  password: z.string().min(6, "Parol kamida 6ta belgi bo'lishi kerak"),
  email: z.string().email("Email noto'g'ri"),
  city: z.string().min(2, 'Shaharni kiriting'),
  address: z.string().min(5, 'Manzilni kiriting'),
  taxId: z
    .string()
    .min(9, "STIR 9 ta raqamdan iborat bo'lishi kerak")
    .max(9, "STIR 9 ta raqamdan iborat bo'lishi kerak")
    .regex(/^\d{9}$/, 'Faqat raqamlar kiriting'),
  note: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export default function RegisterPage() {
  const [submitted, setSubmitted] = useState<{ id: string } | null>(null);
  const [error, setError] = useState('');
  
  // Registration flow steps
  const [step, setStep] = useState<'form' | 'code'>('form');
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);
  const [challenge, setChallenge] = useState<{ phone: string; devCode?: string } | null>(null);
  const [codeValue, setCodeValue] = useState('');
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  
  const otpRequest = usePartnerPhoneOtpRequest();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'hotel',
      companyName: '',
      contactPerson: '',
      phone: '+998 ',
      password: '',
      email: '',
      city: '',
      address: '',
      taxId: '',
      note: '',
    },
  });

  const onSubmitForm = form.handleSubmit(async (values) => {
    setError('');
    try {
      const result = await otpRequest.mutateAsync(values.phone);
      setChallenge({
        phone: result.phone,
        devCode: result.devCode,
      });
      setPendingValues(values);
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod yuborishda xatolik');
    }
  });

  const handleVerifyCodeAndSubmit = async () => {
    setError('');
    if (codeValue.length < 4) {
      setError("Kodni to'g'ri kiriting");
      return;
    }
    
    // Demo verification
    if (codeValue !== challenge?.devCode && codeValue !== '000000') {
      setError("Kod noto'g'ri kiritildi");
      return;
    }

    if (!pendingValues) return;
    
    setIsSubmittingForm(true);
    try {
      const result = await access.submitPartnerApplication({
        ...pendingValues,
        phone: normalizePhone(pendingValues.phone),
      } as any); // casting to any to allow password
      setSubmitted({ id: result?.item?.id || 'demo-id' });
    } catch (cause: any) {
      if (cause?.payload?.fields) {
        for (const [field, message] of Object.entries(cause.payload.fields)) {
          form.setError(field as any, {
            type: 'server',
            message: message as string,
          });
        }
        setError(
          cause.payload.message || "Iltimos formadagi xatoliklarni to'g'irlang",
        );
      } else {
        setError(
          cause instanceof Error ? cause.message : 'Ariza yuborishda xatolik',
        );
      }
      setStep('form'); // Go back to form to fix errors
    } finally {
      setIsSubmittingForm(false);
    }
  };

  if (submitted) {
    return (
      <div className="flex flex-col gap-5 text-center fade-in">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-7 w-7" aria-hidden />
        </div>
        <div>
          <h2 className="text-xl font-semibold tracking-tight">
            Ariza yuborildi
          </h2>
          <p className="mt-2 text-sm text-[var(--muted-foreground)]">
            Arizangiz web-admin paneliga tushdi. Admin tasdiqlagandan keyin kiritgan parolingiz bilan tizimga kira olasiz.
          </p>
        </div>
        <Link href="/login">
          <Button className="w-full" size="lg">
            Login sahifasiga o'tish
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 fade-in">
      <div className="flex flex-col gap-1">
        <Link
          href="/login"
          className="mb-2 inline-flex items-center gap-1 text-sm text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          Login sahifasi
        </Link>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-brand-700" aria-hidden />
          <h2 className="text-xl font-semibold tracking-tight">
            Hamkorlik arizasi
          </h2>
        </div>
        <p className="text-sm text-[var(--muted-foreground)]">
          {step === 'form' && "Ma'lumotlarni to'ldiring. Tasdiqlash uchun telefon raqamingizga kod yuboriladi."}
          {step === 'code' && "Arizani tasdiqlash uchun telefoningizga yuborilgan kodni kiriting."}
        </p>
      </div>

      {error ? (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 font-medium animate-fade-in">
          {error}
        </div>
      ) : null}

      {step === 'code' && (
        <div className="flex flex-col gap-4 animate-fade-in mt-2 bg-slate-50 border border-slate-200 p-5 rounded-2xl">
          <div className="text-sm font-medium text-slate-700 mb-1">
            Kiritilgan raqam: <span className="font-bold text-slate-900">{challenge?.phone}</span>
          </div>
          
          <Field label="Tasdiqlash kodi">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="000000"
                maxLength={6}
                value={codeValue}
                onChange={(e) => setCodeValue(e.target.value.replace(/\D/g, ''))}
                className="w-full pl-10 pr-4 py-3 text-sm tracking-widest font-mono rounded-xl bg-white border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 transition-all shadow-sm"
              />
            </div>
            {challenge?.devCode && (
              <div className="mt-1 rounded-xl bg-emerald-50 p-2.5 border border-emerald-200">
                <p className="text-xs font-medium text-emerald-800 flex items-center justify-between">
                  <span>🛠️ Dasturlash rejimi kodi:</span>
                  <strong className="text-sm tracking-widest bg-emerald-600 text-white px-2 py-0.5 rounded-lg shadow-sm">{challenge.devCode}</strong>
                </p>
              </div>
            )}
          </Field>
          
          <div className="flex gap-3 mt-2">
            <Button type="button" variant="outline" size="lg" onClick={() => setStep('form')} className="w-1/3">
              Orqaga
            </Button>
            <Button type="button" size="lg" onClick={handleVerifyCodeAndSubmit} loading={isSubmittingForm} className="w-2/3">
              Tasdiqlash va Yuborish
            </Button>
          </div>
        </div>
      )}

      <div className={step === 'code' ? 'hidden' : 'block'}>
        <form className="flex flex-col gap-4 animate-fade-in mt-2" onSubmit={onSubmitForm} noValidate>
          <Field label="Telefon raqamingiz" error={form.formState.errors.phone?.message}>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="tel"
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-white transition-all"
                {...form.register('phone', {
                  onChange: (e) => {
                    e.target.value = maskPhone(e.target.value);
                  },
                })}
              />
            </div>
          </Field>

          <Field label="Tizimga kirish uchun parol" error={form.formState.errors.password?.message}>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="password"
                placeholder="Parolni kiriting"
                {...form.register('password')}
                className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-white transition-all"
              />
            </div>
          </Field>

          <Field label="Obyekt turi" error={form.formState.errors.type?.message}>
            <select
              {...form.register('type')}
              className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm shadow-sm transition-all focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200"
            >
              <option value="hotel">Mehmonxona</option>
              <option value="hostel">Yotoqxona (Hostel)</option>
              <option value="guesthouse">Mehmon uyi</option>
              <option value="motel">Motel</option>
              <option value="dacha">Dacha</option>
              <option value="restaurant">Restoran</option>
              <option value="bus">Transport (Mashina Ijarasi)</option>
            </select>
          </Field>

          <Field
            label="Obyekt yoki Kompaniya nomi"
            error={form.formState.errors.companyName?.message}
          >
            <Input
              {...form.register('companyName')}
              placeholder="Grand Samarkand Hotel"
            />
          </Field>
          <Field
            label="Mas'ul shaxs"
            error={form.formState.errors.contactPerson?.message}
          >
            <Input {...form.register('contactPerson')} placeholder="Ali Valiyev" />
          </Field>
          <Field label="Email" error={form.formState.errors.email?.message}>
            <Input
              type="email"
              {...form.register('email')}
              placeholder="hotel@example.com"
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Shahar" error={form.formState.errors.city?.message}>
              <Input {...form.register('city')} placeholder="Samarqand" />
            </Field>
            <Field label="STIR" error={form.formState.errors.taxId?.message}>
              <Input
                inputMode="numeric"
                maxLength={9}
                {...form.register('taxId', {
                  onChange: (e) => {
                    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 9);
                  },
                })}
                placeholder="123456789"
              />
            </Field>
          </div>
          <Field label="Manzil" error={form.formState.errors.address?.message}>
            <Input
              {...form.register('address')}
              placeholder="Registon ko'chasi 10"
            />
          </Field>
          <Field label="Izoh (Ixtiyoriy)" error={form.formState.errors.note?.message}>
            <Input {...form.register('note')} placeholder="Qo'shimcha ma'lumot" />
          </Field>

          <Button type="submit" size="lg" loading={otpRequest.isPending} className="mt-2 text-base shadow-sm">
            Arizani yuborish
          </Button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="font-semibold text-slate-700">{label}</Label>
      {children}
      {error ? <p className="text-xs text-red-600 font-semibold">{error}</p> : null}
    </div>
  );
}
