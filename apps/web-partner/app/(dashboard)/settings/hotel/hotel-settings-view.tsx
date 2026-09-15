'use client';

import { Save } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from '../../../_components/ui/card';
import { Input } from '../../../_components/ui/input';
import { PhoneInput } from '../../../_components/ui/phone-input';
import { Button } from '../../../_components/ui/button';
import { Label } from '../../../_components/ui/label';
import { partners } from '../../../_lib/api';
import {
  listingQueryKey,
  useListing,
  useUpdateListingGeneral,
  useUpdateListingLocation,
} from '../../../_hooks/use-listing';
import { useAuthStore } from '../../../_stores/auth-store';
import { getPartnerLabels } from '../../../_lib/utils/partner-labels';
import { PageHeader } from '../../../_components/layout/page-header';

const schema = z.object({
  name: z.string().min(2, 'Nom kamida 2 belgi'),
  inn: z.string().trim().min(3, 'STIR kiriting'),
  phone: z.string().min(7, "Telefon noto'g'ri"),
  email: z.string().email("Email noto'g'ri"),
  address: z.string().min(5, 'Manzil juda qisqa'),
  description: z.string().optional(),
});

type Values = z.infer<typeof schema>;

export function HotelSettingsView() {
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const token = useAuthStore((s) => s.tokens?.accessToken);
  const userEmail = useAuthStore((s) => s.user?.email);
  const { data: listing } = useListing();
  const updateGeneral = useUpdateListingGeneral();
  const updateLocation = useUpdateListingLocation();
  const profileQuery = useQuery({
    queryKey: ['partner', 'profile'],
    queryFn: () => partners.getProfile(token),
    enabled: Boolean(token),
  });
  const updateProfile = useMutation({
    mutationFn: (values: Values) =>
      partners.updateProfile(
        {
          brand_name: values.name,
          tax_id: values.inn,
          phone: values.phone,
          email: values.email,
          address: values.address,
        },
        token,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['partner', 'profile'] });
    },
  });
  const currentValues = useMemo<Values>(
    () => ({
      name:
        listing.name ||
        profileQuery.data?.brand_name ||
        profileQuery.data?.legal_name ||
        '',
      inn: profileQuery.data?.tax_id ?? '',
      phone: profileQuery.data?.phone ?? '',
      email: profileQuery.data?.email ?? userEmail ?? '',
      address: listing.address || profileQuery.data?.address || '',
      description: listing.fullDescription || listing.shortDescription || '',
    }),
    [
      listing.address,
      listing.fullDescription,
      listing.name,
      listing.shortDescription,
      profileQuery.data?.address,
      profileQuery.data?.brand_name,
      profileQuery.data?.email,
      profileQuery.data?.legal_name,
      profileQuery.data?.phone,
      profileQuery.data?.tax_id,
      userEmail,
    ],
  );
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    values: currentValues,
  });

  const onSubmit = form.handleSubmit(async (values) => {
    setSaving(true);
    try {
      await updateProfile.mutateAsync(values);
      await Promise.all([
        updateGeneral.mutateAsync({
          name: values.name,
          shortDescription:
            listing.shortDescription || values.description || values.name,
          fullDescription:
            values.description || listing.fullDescription || values.name,
          stars: listing.stars,
        }),
        updateLocation.mutateAsync({ address: values.address }),
      ]);
      void queryClient.invalidateQueries({ queryKey: listingQueryKey });
      toast.success("Ma'lumotlar saqlandi");
      form.reset(values);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Ma'lumotlarni saqlab bo'lmadi",
      );
    } finally {
      setSaving(false);
    }
  });

  const partnerType = useAuthStore((s) => s.user?.partnerType);
  const labels = getPartnerLabels(partnerType);
  const err = form.formState.errors;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Kompaniya Sozlamalari"
        title={`${labels.topbarSubtitle}`}
        description="Tashuvchi hamkor yoki mehmonxona rekvizitlari, aloqa ma'lumotlari hamda manzilni boshqarish."
      />
      <Card>
        <CardHeader>
          <CardTitle>Asosiy ma'lumotlar</CardTitle>
        </CardHeader>
        <CardBody>
          <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="name">Biznes nomi</Label>
              <Input
                id="name"
                aria-invalid={Boolean(err.name)}
                {...form.register('name')}
              />
              {err.name && (
                <p className="text-xs text-red-600">{err.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="inn">INN</Label>
              <Input
                id="inn"
                aria-invalid={Boolean(err.inn)}
                {...form.register('inn')}
              />
              {err.inn && (
                <p className="text-xs text-red-600">{err.inn.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Aloqa telefoni</Label>
              <PhoneInput
                id="phone"
                aria-invalid={Boolean(err.phone)}
                {...form.register('phone')}
              />
              {err.phone && (
                <p className="text-xs text-red-600">{err.phone.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                aria-invalid={Boolean(err.email)}
                {...form.register('email')}
              />
              {err.email && (
                <p className="text-xs text-red-600">{err.email.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor="address">Manzil</Label>
              <Input
                id="address"
                aria-invalid={Boolean(err.address)}
                {...form.register('address')}
              />
              {err.address && (
                <p className="text-xs text-red-600">{err.address.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5 md:col-span-2">
              <Label htmlFor="description">Tavsif (mijozlar uchun)</Label>
              <textarea
                id="description"
                rows={3}
                placeholder="Biznesingiz haqida qisqacha ma'lumot..."
                className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] p-3 text-sm focus:border-brand-600 focus:outline-none"
                {...form.register('description')}
              />
            </div>

            <div className="md:col-span-2 flex items-center gap-2">
              <Button
                type="submit"
                disabled={saving || !form.formState.isDirty}
              >
                <Save className="h-4 w-4" aria-hidden />
                {saving ? 'Saqlanmoqda...' : 'Saqlash'}
              </Button>
              {form.formState.isDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => form.reset(currentValues)}
                >
                  Bekor qilish
                </Button>
              )}
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
