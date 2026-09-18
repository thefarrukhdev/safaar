'use client';

import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Mail, Lock } from 'lucide-react';
import { usePartnerEmailLogin } from '../../_hooks/use-auth';
import { PasswordInput } from '../../_components/ui/password-input';

const loginSchema = z.object({
  email: z.string().email("To'g'ri email kiriting"),
  password: z.string().min(1, "Parolni kiriting"),
});

type LoginValues = z.infer<typeof loginSchema>;

export function LoginForm() {
  const login = usePartnerEmailLogin();
  
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await login.mutateAsync({
      email: values.email,
      password: values.password,
    });
  });

  const loading = login.isPending;

  return (
    <form
      className="flex flex-col gap-4 fade-in"
      onSubmit={onSubmit}
      noValidate
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-xs font-bold text-slate-700">
          Email manzil
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" />
          <input
            id="email"
            type="email"
            placeholder="partner@safaar.uz"
            className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-50"
            disabled={loading}
            {...form.register('email')}
          />
        </div>
        {form.formState.errors.email && (
          <p className="text-xs text-rose-600 font-semibold">{form.formState.errors.email.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-1.5 animate-fade-in">
        <label htmlFor="password" className="text-xs font-bold text-slate-700">
          Parol
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 z-10" />
          <PasswordInput
            id="password"
            placeholder="••••••••"
            className="w-full pl-10 pr-10 py-3 text-sm tracking-widest rounded-xl bg-slate-50 border border-slate-200 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-600 focus:bg-white transition-all disabled:opacity-50"
            disabled={loading}
            {...form.register('password')}
          />
        </div>
        {form.formState.errors.password && (
          <p className="text-xs text-rose-600 font-semibold">{form.formState.errors.password.message}</p>
        )}
      </div>

      <div className="flex flex-col gap-3 mt-2">
        <button
          type="submit"
          disabled={loading}
          className="relative w-full rounded-xl bg-blue-600 px-4 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:scale-[0.98] transition-all disabled:opacity-70 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              Biroz kuting...
            </span>
          ) : (
            "Tizimga kirish"
          )}
        </button>
      </div>
    </form>
  );
}
