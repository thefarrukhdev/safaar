'use client';

import { Phone, Save, ShieldCheck } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from '../../../_components/ui/card';
import { Button } from '../../../_components/ui/button';
import { Input } from '../../../_components/ui/input';
import { Label } from '../../../_components/ui/label';
import { useAuthStore } from '../../../_stores/auth-store';

const schema = z.object({
  fullName: z.string().min(2, "Ism kamida 2 belgi bo'lishi kerak"),
  email: z
    .string()
    .trim()
    .min(1, 'Email kiriting')
    .email("Email noto'g'ri formatda")
    .transform((value) => value.toLowerCase()),
});

type Values = z.infer<typeof schema>;

export function ProfileSettingsView() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: {
      fullName: user?.fullName ?? '',
      email: user?.email ?? '',
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    updateUser({
      fullName: values.fullName,
      email: values.email,
    });
    toast.success("Profil ma'lumotlari saqlandi");
    form.reset(values);
  });

  if (!user) {
    return null;
  }

  const err = form.formState.errors;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Profil</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fullName">Ism familiya</Label>
              <Input
                id="fullName"
                aria-invalid={Boolean(err.fullName)}
                {...form.register('fullName')}
              />
              {err.fullName ? (
                <p className="text-xs text-red-600">{err.fullName.message}</p>
              ) : null}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email manzil</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(err.email)}
                {...form.register('email')}
              />
              {err.email ? (
                <p className="text-xs text-red-600">{err.email.message}</p>
              ) : null}
            </div>

            <div className="md:col-span-2">
              <Button type="submit" disabled={!form.formState.isDirty}>
                <Save className="h-4 w-4" aria-hidden />
                Saqlash
              </Button>
            </div>
          </form>
        </CardBody>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardBody className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700">
              <ShieldCheck className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Access holati</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Bu profil admin tomonidan tasdiqlangan hisob orqali ishlaydi.
              </p>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <Phone className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Kirish usuli</h3>
              <p className="mt-1 text-sm text-[var(--muted-foreground)]">
                Tasdiqlangan telefon raqam va parol bilan kabinetga kiriladi.
              </p>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
